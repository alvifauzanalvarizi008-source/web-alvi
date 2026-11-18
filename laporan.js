const CATALOG_STORAGE_KEY = 'sarprasCatalogV2';
const CATALOG_DELETED_KEY = 'sarprasCatalogDeletedV1';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getCatalogItemName = (item) => {
  const savedName = String(item.nama || '').trim();
  if (savedName) return savedName;
  const initialItem = (Array.isArray(window.sarprasInitialItems) ? window.sarprasInitialItems : [])
    .find((entry) => entry.kode === item.kode || entry.id === item.id);
  return String(initialItem?.nama || '');
};

const formatInventoryCode = (categoryCode, number) => `${categoryCode}-${String(number).padStart(3, '0')}`;

const getInitialCatalog = () => {
  const categories = Array.isArray(window.sarprasInitialCatalog) ? window.sarprasInitialCatalog : [];
  return categories.flatMap((category, categoryIndex) =>
    (Array.isArray(category.barang) ? category.barang : []).map((item) => ({
      id: `${category.kode || categoryIndex}-${item.nomor}`,
      kode: formatInventoryCode(category.kode || categoryIndex, item.nomor),
      kategori: category.nama || 'Tanpa kategori',
      nama: item.nama || '',
      jumlah: 0,
      kondisi: 'Baik',
    })));
};

const loadReportItems = () => {
  const fallback = getInitialCatalog();
  let deletedCodes = [];
  try {
    const savedDeletedCodes = JSON.parse(localStorage.getItem(CATALOG_DELETED_KEY));
    if (Array.isArray(savedDeletedCodes)) deletedCodes = savedDeletedCodes;
  } catch (error) {
    console.warn('Gagal membaca daftar barang yang dihapus:', error);
  }
  const deletedCodeSet = new Set(deletedCodes);
  const availableFallback = fallback.filter((item) => !deletedCodeSet.has(item.kode));
  let savedCatalog = [];
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY));
    if (Array.isArray(saved)) savedCatalog = saved;
  } catch (error) {
    console.warn('Gagal membaca katalog laporan dari localStorage:', error);
  }

  const categoryCodeByName = new Map(
    (Array.isArray(window.sarprasInitialCatalog) ? window.sarprasInitialCatalog : [])
      .map((category, index) => [category.nama, String(category.kode || index)]),
  );
  const savedByCode = new Map(savedCatalog.map((item) => {
    const categoryCode = categoryCodeByName.get(item.kategori);
    const [idCategoryCode, idNumber] = String(item.id || '').split('-');
    const kode = item.kode || (idCategoryCode === categoryCode && /^\d+$/.test(idNumber)
      ? formatInventoryCode(categoryCode, Number(idNumber))
      : '');
    return [kode, item];
  }).filter(([kode]) => kode));
  const initialCodes = new Set(fallback.map((item) => item.kode));
  const catalog = availableFallback.map((item) => {
    const saved = savedByCode.get(item.kode);
    const jumlah = Number(saved?.jumlah);
    return {
      ...item,
      jumlah: Number.isSafeInteger(jumlah) && jumlah >= 0 ? jumlah : item.jumlah,
      kondisi: ['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(saved?.kondisi) ? saved.kondisi : item.kondisi,
    };
  });
  const customCodes = new Set(initialCodes);
  savedCatalog.forEach((item) => {
    if (!String(item.id || '').startsWith('new-item-')
      || !item.kode
      || customCodes.has(item.kode)
      || !categoryCodeByName.has(item.kategori)) return;

    customCodes.add(item.kode);
    const jumlah = Number(item.jumlah);
    catalog.push({
      ...item,
      jumlah: Number.isSafeInteger(jumlah) && jumlah >= 0 ? jumlah : 0,
      kondisi: ['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(item.kondisi) ? item.kondisi : 'Baik',
    });
  });

  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch (error) {
    console.error('Gagal menyimpan katalog laporan terbaru ke localStorage:', error);
  }
  return catalog;
};

const renderReportRows = (items, query = '') => {
  const rowsEl = document.getElementById('reportRows');
  const emptyEl = document.getElementById('reportEmpty');
  const countEl = document.getElementById('reportCount');

  if (!rowsEl) return;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesQuery = !normalizedQuery || [item.kode, getCatalogItemName(item), item.kategori].join(' ').toLowerCase().includes(normalizedQuery);
    return matchesQuery;
  });

  rowsEl.innerHTML = filtered.map((item) => `
    <tr>
      <td>${escapeHtml(item.kode || '-')}</td>
      <td>${escapeHtml(item.kategori || '-')}</td>
      <td>${escapeHtml(getCatalogItemName(item) || '-')}</td>
      <td>${escapeHtml(item.jumlah ?? 0)}</td>
      <td><span class="badge ${item.kondisi === 'Rusak Ringan' ? 'ringan' : item.kondisi === 'Rusak Berat' ? 'berat' : 'baik'}">${escapeHtml(item.kondisi || 'Baik')}</span></td>
      <td><div class="row-actions">
        <button type="button" class="action-button print-report-item">Cetak</button>
        ${['admin', 'operator'].includes(window.sarprasRole) ? `<button type="button" class="action-button delete delete-report-item" data-item-code="${escapeHtml(item.kode)}">Hapus</button>` : ''}
      </div></td>
    </tr>
  `).join('');

  if (emptyEl) emptyEl.hidden = filtered.length > 0;
  if (countEl) countEl.textContent = `${filtered.length} barang ditampilkan`;
};

const getIsoWeekValue = (date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const getWeekBounds = (weekValue) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
};

const renderWeeklyReport = (weekValue) => {
  const bounds = getWeekBounds(weekValue);
  const range = document.getElementById('weeklyReportRange');
  const rowsEl = document.getElementById('weeklyReportRows');
  const emptyEl = document.getElementById('weeklyReportEmpty');
  if (!bounds || !rowsEl) return;

  const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
  if (range) range.textContent = `${formatDate(bounds.start)} – ${formatDate(bounds.end)}`;

  let loans = [];
  try {
    const savedLoans = JSON.parse(localStorage.getItem('sarprasLoans'));
    if (Array.isArray(savedLoans)) loans = savedLoans;
  } catch (error) {
    console.error('Gagal membaca transaksi untuk laporan mingguan:', error);
    rowsEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Data peminjaman gagal dibaca dari penyimpanan browser.';
    }
    return;
  }

  const catalogCodes = new Set(loadReportItems().map((item) => item.kode));
  const weeklyLoans = loans.filter((loan) => {
    const loanDate = String(loan.tanggalPinjam || '').slice(0, 10);
    return catalogCodes.has(loan.itemCode) && loanDate >= bounds.start && loanDate <= bounds.end;
  }).sort((a, b) => String(a.tanggalPinjam).localeCompare(String(b.tanggalPinjam)));

  const statusLabels = {
    menunggu_persetujuan: 'Menunggu persetujuan',
    dipinjam: 'Dipinjam',
    dikembalikan: 'Dikembalikan',
    ditolak: 'Ditolak',
  };
  const statusClasses = {
    menunggu_persetujuan: 'text-bg-warning',
    dipinjam: 'text-bg-info',
    dikembalikan: 'text-bg-success',
    ditolak: 'text-bg-danger',
  };
  const canManageLoans = ['admin', 'operator'].includes(window.sarprasRole);
  rowsEl.innerHTML = weeklyLoans.map((loan) => `
    <tr>
      <td>${escapeHtml(loan.tanggalPinjam || '-')}</td>
      <td>${escapeHtml(loan.itemName || loan.itemCode || '-')}</td>
      <td>${escapeHtml(loan.jumlah ?? 1)}</td>
      <td>${escapeHtml(loan.borrower || '-')}</td>
      <td>${escapeHtml(loan.kelas || '-')}</td>
      <td>${escapeHtml(loan.jatuhTempo || '-')}</td>
      <td><span class="badge ${statusClasses[loan.status] || 'ringan'}">${escapeHtml(statusLabels[loan.status] || 'Status tidak diketahui')}</span></td>
      <td class="weekly-actions">
        <div class="d-flex flex-wrap gap-1">
          <button type="button" class="btn btn-sm btn-outline-primary print-weekly-loan" data-loan-id="${escapeHtml(loan.id)}">Cetak PDF</button>
          ${canManageLoans ? `<button type="button" class="btn btn-sm btn-outline-danger delete-weekly-loan" data-loan-id="${escapeHtml(loan.id)}">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
  if (emptyEl) emptyEl.hidden = weeklyLoans.length > 0;
};

const deleteWeeklyLoan = (button) => {
  if (!['admin', 'operator'].includes(window.sarprasRole)) return;

  const loanId = button.dataset.loanId;
  if (!loanId) return;

  let loans;
  try {
    loans = JSON.parse(localStorage.getItem('sarprasLoans'));
  } catch (error) {
    console.error('Gagal membaca transaksi peminjaman:', error);
    window.alert('Transaksi gagal dibaca. Coba muat ulang halaman.');
    return;
  }
  if (!Array.isArray(loans)) return;

  const loan = loans.find((entry) => entry.id === loanId);
  if (!loan) {
    window.alert('Transaksi peminjaman tidak ditemukan.');
    renderWeeklyReport(document.getElementById('reportWeek').value);
    return;
  }
  if (!window.confirm(`Hapus transaksi peminjaman "${loan.itemName || loan.itemCode || ''}"?`)) return;

  try {
    localStorage.setItem('sarprasLoans', JSON.stringify(loans.filter((entry) => entry.id !== loanId)));
  } catch (error) {
    console.error('Gagal menghapus transaksi peminjaman:', error);
    window.alert('Transaksi gagal dihapus. Periksa penyimpanan browser lalu coba lagi.');
    return;
  }

  renderWeeklyReport(document.getElementById('reportWeek').value);
};

const printWeeklyLoan = (button) => {
  const row = button.closest('tr');
  if (!row) {
    console.error('Baris transaksi mingguan tidak ditemukan untuk dicetak.');
    return;
  }

  document.querySelectorAll('#weeklyReportRows .print-target').forEach((item) => {
    item.classList.remove('print-target');
  });
  row.classList.add('print-target');
  document.body.classList.add('print-weekly-loan');

  const resetPrintView = () => {
    row.classList.remove('print-target');
    document.body.classList.remove('print-weekly-loan');
  };
  window.addEventListener('afterprint', resetPrintView, { once: true });

  try {
    window.print();
  } catch (error) {
    resetPrintView();
    console.error('Gagal mencetak transaksi mingguan:', error);
    window.alert('Transaksi gagal dicetak.');
  }
};

const syncReport = () => {
  const items = loadReportItems();
  const searchInput = document.getElementById('reportSearch');
  const weekInput = document.getElementById('reportWeek');

  renderReportRows(items, searchInput ? searchInput.value : '');
  if (weekInput) renderWeeklyReport(weekInput.value);
};

const printReportItem = (button) => {
  const row = button.closest('tr');
  if (!row) {
    console.error('Baris barang laporan tidak ditemukan untuk dicetak.');
    return;
  }

  document.querySelectorAll('#reportRows .print-target').forEach((item) => {
    item.classList.remove('print-target');
  });
  row.classList.add('print-target');
  document.body.classList.add('print-report-item');

  const resetPrintView = () => {
    row.classList.remove('print-target');
    document.body.classList.remove('print-report-item');
  };
  window.addEventListener('afterprint', resetPrintView, { once: true });

  try {
    window.print();
  } catch (error) {
    resetPrintView();
    console.error('Gagal mencetak barang dari laporan:', error);
  }
};

const deleteReportItem = (button) => {
  if (!['admin', 'operator'].includes(window.sarprasRole)) return;

  const itemCode = button.dataset.itemCode;
  const items = loadReportItems();
  const item = items.find((entry) => entry.kode === itemCode);
  if (!item) {
    console.error('Barang laporan tidak ditemukan untuk dihapus.');
    return;
  }
  if (!window.confirm(`Hapus "${item.nama}" dari daftar barang inventaris?`)) return;

  const nextItems = items.filter((entry) => entry.kode !== itemCode);
  const initialItem = (Array.isArray(window.sarprasInitialItems) ? window.sarprasInitialItems : [])
    .find((entry) => entry.kode === itemCode);

  try {
    if (initialItem) {
      const savedDeletedCodes = JSON.parse(localStorage.getItem(CATALOG_DELETED_KEY));
      const deletedCodes = Array.isArray(savedDeletedCodes) ? savedDeletedCodes : [];
      if (!deletedCodes.includes(itemCode)) deletedCodes.push(itemCode);
      localStorage.setItem(CATALOG_DELETED_KEY, JSON.stringify(deletedCodes));
    }
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(nextItems));
  } catch (error) {
    console.error('Gagal menghapus barang dari katalog:', error);
    window.alert('Barang gagal dihapus. Periksa penyimpanan browser lalu coba lagi.');
    return;
  }

  syncReport();
};

window.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('reportSearch');
  const weekInput = document.getElementById('reportWeek');

  if (weekInput) weekInput.value = getIsoWeekValue(new Date());

  syncReport();

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const items = loadReportItems();
      renderReportRows(items, event.target.value);
    });
  }

  if (weekInput) {
    weekInput.addEventListener('change', () => renderWeeklyReport(weekInput.value));
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const printButton = target.closest('.print-report-item');
    if (printButton instanceof HTMLButtonElement) {
      printReportItem(printButton);
    }

    const deleteButton = target.closest('.delete-report-item');
    if (deleteButton instanceof HTMLButtonElement) {
      deleteReportItem(deleteButton);
    }

    const deleteLoanButton = target.closest('.delete-weekly-loan');
    if (deleteLoanButton instanceof HTMLButtonElement) {
      deleteWeeklyLoan(deleteLoanButton);
    }

    const printLoanButton = target.closest('.print-weekly-loan');
    if (printLoanButton instanceof HTMLButtonElement) {
      printWeeklyLoan(printLoanButton);
    }
  });
});
