const INVENTORY_CONDITIONS = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
const CATALOG_STORAGE_KEY = 'sarprasCatalogV2';
const CATALOG_DELETED_KEY = 'sarprasCatalogDeletedV1';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getCategoryCode = (categoryName) => {
  const category = (Array.isArray(window.sarprasInitialCatalog) ? window.sarprasInitialCatalog : [])
    .find((entry) => entry.nama === categoryName);
  return category ? String(category.kode) : '0';
};

const formatInventoryCode = (categoryCode, number) => `${categoryCode}-${String(number).padStart(3, '0')}`;

const getCatalogItemName = (item) => {
  const savedName = String(item.nama || '').trim();
  if (savedName) return savedName;
  const initialItem = (Array.isArray(window.sarprasInitialItems) ? window.sarprasInitialItems : [])
    .find((entry) => entry.kode === item.kode || entry.id === item.id);
  return String(initialItem?.nama || '');
};

const getNextInventoryCode = (catalog, categoryName, excludeId) => {
  const categoryCode = getCategoryCode(categoryName);
  const prefix = `${categoryCode}-`;
  const numbers = catalog
    .filter((item) => item.id !== excludeId && item.kategori === categoryName)
    .map((item) => {
      const code = String(item.kode || item.id || '');
      return code.startsWith(prefix) ? Number(code.slice(prefix.length)) : 0;
    })
    .filter(Number.isFinite);
  return formatInventoryCode(categoryCode, Math.max(0, ...numbers) + 1);
};

const getCatalog = () => {
  const categories = Array.isArray(window.sarprasInitialCatalog)
    ? window.sarprasInitialCatalog
    : [];
  const initialItems = Array.isArray(window.sarprasInitialItems) ? window.sarprasInitialItems : [];
  const initialCatalog = initialItems.map((item) => ({
    id: String(item.id || item.kode),
    kode: String(item.kode || ''),
    kategori: item.kategori || 'Tanpa kategori',
    nama: item.nama || '',
    jumlah: Number.isSafeInteger(Number(item.jumlah)) && Number(item.jumlah) >= 0
      ? Number(item.jumlah)
      : 0,
    kondisi: INVENTORY_CONDITIONS.includes(item.kondisi) ? item.kondisi : 'Baik',
  }));

  let savedCatalog = [];
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY));
    if (Array.isArray(saved)) savedCatalog = saved;
  } catch (error) {
    console.warn('Gagal membaca katalog barang dari localStorage:', error);
  }

  const savedByCode = new Map(savedCatalog.map((item) => {
    const [idCategoryCode, idNumber] = String(item.id || '').split('-');
    const categoryCode = getCategoryCode(item.kategori);
    const kode = item.kode || (idCategoryCode === categoryCode && /^\d+$/.test(idNumber)
      ? formatInventoryCode(categoryCode, Number(idNumber))
      : '');
    return [kode, item];
  }).filter(([kode]) => kode));
  let deletedCodes = [];
  try {
    const savedDeletedCodes = JSON.parse(localStorage.getItem(CATALOG_DELETED_KEY));
    if (Array.isArray(savedDeletedCodes)) deletedCodes = savedDeletedCodes;
  } catch (error) {
    console.warn('Gagal membaca daftar barang yang dihapus:', error);
  }
  const deletedCodeSet = new Set(deletedCodes);
  const availableInitialCatalog = initialCatalog.filter((item) => !deletedCodeSet.has(item.kode));
  const initialCodes = new Set(initialCatalog.map((item) => item.kode));
  const catalog = availableInitialCatalog.map((item) => {
    const saved = savedByCode.get(item.kode);
    const jumlah = Number(saved?.jumlah);
    return {
      ...item,
      jumlah: Number.isSafeInteger(jumlah) && jumlah >= 0 ? jumlah : item.jumlah,
      kondisi: INVENTORY_CONDITIONS.includes(saved?.kondisi) ? saved.kondisi : item.kondisi,
    };
  });
  const customCodes = new Set(initialCodes);
  savedCatalog.forEach((item) => {
    if (!String(item.id || '').startsWith('new-item-')
      || !item.kode
      || customCodes.has(item.kode)
      || !categories.some((category) => category.nama === item.kategori)) return;

    customCodes.add(item.kode);
    const jumlah = Number(item.jumlah);
    catalog.push({
      ...item,
      jumlah: Number.isSafeInteger(jumlah) && jumlah >= 0 ? jumlah : 0,
      kondisi: INVENTORY_CONDITIONS.includes(item.kondisi) ? item.kondisi : 'Baik',
    });
  });

  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch (error) {
    console.error('Gagal menyimpan katalog terbaru ke localStorage:', error);
  }
  return catalog;
};

const renderStats = (items) => {
  const totalUnit = items.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
  const counts = { Baik: 0, 'Rusak Ringan': 0, 'Rusak Berat': 0 };
  items.forEach((item) => {
    const kondisi = item.kondisi || 'Baik';
    if (counts[kondisi] !== undefined) counts[kondisi] += Number(item.jumlah || 0);
  });

  const totalBarang = document.getElementById('totalBarang');
  const totalBaik = document.getElementById('totalBaik');
  const totalRingan = document.getElementById('totalRingan');
  const totalBerat = document.getElementById('totalBerat');

  if (totalBarang) totalBarang.textContent = String(totalUnit);
  if (totalBaik) totalBaik.textContent = String(counts.Baik);
  if (totalRingan) totalRingan.textContent = String(counts['Rusak Ringan']);
  if (totalBerat) totalBerat.textContent = String(counts['Rusak Berat']);
};

const syncDashboard = () => {
  const catalog = getCatalog();
  renderStats(catalog);
  renderInventoryRows(catalog);
  refreshLoanOptions();
};

const renderInventoryRows = (catalog) => {
  const rows = document.getElementById('inventoryRows');
  if (!rows) return;

  rows.innerHTML = catalog.map((item) => `
    <tr>
      <td>${escapeHtml(item.kode || '')}</td>
      <td>${escapeHtml(item.kategori)}</td>
      <td>${escapeHtml(getCatalogItemName(item))}</td>
      <td>${escapeHtml(item.jumlah ?? 0)}</td>
      <td><span class="badge ${item.kondisi === 'Rusak Ringan' ? 'ringan' : item.kondisi === 'Rusak Berat' ? 'berat' : 'baik'}">${escapeHtml(item.kondisi || 'Baik')}</span></td>
      <td><div class="inventory-actions">
        <button type="button" class="action-button edit-inventory" data-item-id="${escapeHtml(item.id)}">Edit</button>
        <button type="button" class="action-button delete delete-inventory" data-item-id="${escapeHtml(item.id)}">Hapus</button>
      </div></td>
    </tr>`
  ).join('');

  const count = document.getElementById('inventoryCount');
  if (count) count.textContent = `${catalog.length} jenis barang dalam katalog`;
};

const saveCatalog = (catalog) => {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
    return true;
  } catch (error) {
    console.error('Gagal menyimpan katalog barang:', error);
    showToast('Perubahan katalog barang gagal disimpan.');
    return false;
  }
};

const editInventoryItem = (itemId) => {
  if ((window.sarprasRole || '').toLowerCase() !== 'admin') return;

  const item = getCatalog().find((entry) => entry.id === itemId);
  const form = document.getElementById('inventoryForm');
  const modal = document.getElementById('inventoryModal');
  if (!item || !form || !modal) return;

  form.dataset.originalItemId = item.id;
  form.elements.kategori.value = item.kategori;
  form.elements.nama.value = getCatalogItemName(item);
  form.elements.kode.value = item.kode || '';
  form.elements.jumlah.value = String(item.jumlah ?? 0);
  form.elements.kondisi.value = item.kondisi || 'Baik';
  document.getElementById('inventoryModalTitle').textContent = 'Edit barang';
  document.getElementById('inventoryModalDescription').textContent = 'Perbarui informasi barang inventaris.';
  document.getElementById('saveInventoryButton').textContent = 'Simpan perubahan';
  modal.classList.add('open');
  form.elements.nama.focus();
};

const addInventoryItem = () => {
  if ((window.sarprasRole || '').toLowerCase() !== 'admin') return;

  const form = document.getElementById('inventoryForm');
  const modal = document.getElementById('inventoryModal');
  if (!form || !modal) return;

  form.reset();
  delete form.dataset.originalItemId;
  form.elements.kode.value = getNextInventoryCode(getCatalog(), form.elements.kategori.value);
  document.getElementById('inventoryModalTitle').textContent = 'Tambah barang';
  document.getElementById('inventoryModalDescription').textContent = 'Masukkan barang baru ke katalog inventaris.';
  document.getElementById('saveInventoryButton').textContent = 'Tambah barang';
  modal.classList.add('open');
  form.elements.kategori.focus();
};

const deleteInventoryItem = (itemId) => {
  if ((window.sarprasRole || '').toLowerCase() !== 'admin') return;

  const catalog = getCatalog();
  const item = catalog.find((entry) => entry.id === itemId);
  if (!item) {
    showToast('Barang tidak ditemukan.');
    return;
  }
  if (!window.confirm(`Hapus "${item.nama}" dari kategori ${item.kategori}?`)) return;

  const nextCatalog = catalog.filter((entry) => entry.id !== itemId);
  const isInitialItem = (Array.isArray(window.sarprasInitialItems) ? window.sarprasInitialItems : [])
    .some((entry) => entry.id === item.id || entry.kode === item.kode);
  if (isInitialItem) {
    try {
      const deletedCodes = JSON.parse(localStorage.getItem(CATALOG_DELETED_KEY));
      const codes = Array.isArray(deletedCodes) ? deletedCodes : [];
      if (!codes.includes(item.kode)) codes.push(item.kode);
      localStorage.setItem(CATALOG_DELETED_KEY, JSON.stringify(codes));
    } catch (error) {
      console.error('Gagal menyimpan penghapusan barang dari katalog:', error);
      showToast('Barang gagal dihapus dari katalog.');
      return;
    }
  }
  if (!saveCatalog(nextCatalog)) return;
  syncDashboard();
  showToast('Barang berhasil dihapus dari katalog.');
};

const generateReportSummary = () => {
  const summary = document.getElementById('reportSummary');
  if (!summary) return;

  const items = getCatalog();
  const loans = getLoans();
  const totalUnits = items.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
  const pending = loans.filter((loan) => loan.status === 'menunggu_persetujuan').length;
  const borrowed = loans.filter((loan) => loan.status === 'dipinjam').length;
  const returned = loans.filter((loan) => loan.status === 'dikembalikan').length;

  summary.innerHTML = `
    <div class="report-grid">
      <div><strong>${totalUnits}</strong><span>Total unit barang</span></div>
      <div><strong>${pending}</strong><span>Menunggu persetujuan</span></div>
      <div><strong>${borrowed}</strong><span>Sedang dipinjam</span></div>
      <div><strong>${returned}</strong><span>Sudah dikembalikan</span></div>
    </div>
    <p>Dibuat: ${new Date().toLocaleString('id-ID')}</p>
  `;
};

const showToast = (message) => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
};

const getLoans = () => {
  let savedLoans;
  try {
    savedLoans = JSON.parse(localStorage.getItem('sarprasLoans'));
  } catch (error) {
    console.error('Gagal membaca data peminjaman:', error);
    return [];
  }

  if (!Array.isArray(savedLoans)) return [];

  const catalogCodes = new Set(getCatalog().map((item) => item.kode));
  const currentLoans = savedLoans.filter((loan) => catalogCodes.has(loan.itemCode));
  if (currentLoans.length !== savedLoans.length) {
    try {
      saveLoans(currentLoans);
      console.info(`Dihapus ${savedLoans.length - currentLoans.length} riwayat barang yang tidak ada di katalog terbaru.`);
    } catch (error) {
      console.error('Gagal menghapus riwayat peminjaman barang lama:', error);
    }
  }
  return currentLoans;
};

const saveLoans = (loans) => {
  localStorage.setItem('sarprasLoans', JSON.stringify(loans));
};

const isLoanManager = () => ['admin', 'operator'].includes((window.sarprasRole || 'admin').toLowerCase());

const refreshBorrowerOptions = () => {
  const classSelect = document.getElementById('loanClassSelect');
  const borrowerSelect = document.getElementById('loanBorrower');
  if (!classSelect || !borrowerSelect) return;

  const selectedClass = classSelect.value;
  const currentName = borrowerSelect.value;
  const borrowers = Array.isArray(window.sarprasBorrowers) ? window.sarprasBorrowers : [];
  const options = selectedClass
    ? borrowers.filter((borrower) => borrower.kelas.split(' ')[0] === selectedClass)
    : borrowers;

  borrowerSelect.innerHTML = options.length
    ? `<option value="">Pilih nama peminjam</option>${options.map((borrower) => `
        <option value="${escapeHtml(borrower.nama)}" data-kelas="${escapeHtml(borrower.kelas)}">${escapeHtml(borrower.nama)} (${escapeHtml(borrower.kelas)})</option>
      `).join('')}`
    : '<option value="">Daftar nama tidak tersedia</option>';
  borrowerSelect.disabled = options.length === 0;

  if (currentName && options.some((borrower) => borrower.nama === currentName)) {
    borrowerSelect.value = currentName;
  }
  refreshReturnOptions();
};

const refreshLoanOptions = () => {
  const items = getCatalog();
  const select = document.getElementById('loanItemSelect');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = `<option value="">Pilih barang</option>${items.map((item) => `
    <option value="${escapeHtml(item.kode || '')}">${escapeHtml(item.kode || '-')} - ${escapeHtml(getCatalogItemName(item) || '-')} (${escapeHtml(item.kategori || '-')}; stok ${escapeHtml(item.jumlah ?? 0)})</option>
  `).join('')}`;

  if (items.some((item) => item.kode === currentValue)) {
    select.value = currentValue;
  }
};

const refreshReturnOptions = () => {
  const select = document.getElementById('returnLoanSelect');
  if (!select) return;

  const isManager = isLoanManager();
  const borrower = document.getElementById('loanBorrower')?.value || '';
  if (!isManager && !borrower) {
    select.innerHTML = '<option value="">Pilih nama peminjam terlebih dahulu</option>';
    return;
  }

  const loans = getLoans().filter((loan) => loan.status === 'dipinjam'
    && (isManager || loan.borrower === borrower));
  if (!loans.length) {
    select.innerHTML = `<option value="">${isManager ? 'Tidak ada peminjaman aktif' : 'Tidak ada peminjaman aktif untuk nama ini'}</option>`;
    return;
  }

  const currentValue = loans.some((loan) => loan.id === select.value) ? select.value : loans[0].id;
  select.innerHTML = loans.map((loan) => `
    <option value="${loan.id}">${escapeHtml(loan.itemName || '-')} (${escapeHtml(loan.jumlah ?? 1)} unit) - ${escapeHtml(loan.borrower || '-')}</option>
  `).join('');
  select.value = currentValue;
};

const renderLoanRows = () => {
  const rowsEl = document.getElementById('loanRows');
  if (!rowsEl) return;

  const loans = getLoans();
  if (!loans.length) {
    rowsEl.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #748094;">Belum ada data peminjaman.</td></tr>';
    return;
  }

  rowsEl.innerHTML = loans.map((loan) => {
    const statusLabels = {
      menunggu_persetujuan: 'Menunggu persetujuan',
      dipinjam: 'Dipinjam',
      dikembalikan: 'Dikembalikan',
      ditolak: 'Ditolak',
    };
    const statusClasses = {
      menunggu_persetujuan: 'ringan',
      dipinjam: 'baik',
      dikembalikan: 'baik',
      ditolak: 'berat',
    };
    let actions = '-';
    if (isLoanManager() && loan.status === 'menunggu_persetujuan') {
      actions = `
        <button type="button" class="action-button approve-loan" data-id="${escapeHtml(loan.id)}">Setujui</button>
        <button type="button" class="action-button delete reject-loan" data-id="${escapeHtml(loan.id)}">Tolak</button>
      `;
    } else if (isLoanManager() && loan.status === 'dipinjam') {
      actions = `<button type="button" class="action-button return-loan" data-id="${escapeHtml(loan.id)}">Kembalikan</button>`;
    }

    return `
    <tr>
      <td>${escapeHtml(loan.itemName || '-')}</td>
      <td>${escapeHtml(loan.jumlah ?? 1)}</td>
      <td>${escapeHtml(loan.borrower || '-')}</td>
      <td>${escapeHtml(loan.kelas || '-')}</td>
      <td>${escapeHtml(loan.tanggalPinjam || '-')}</td>
      <td>${escapeHtml(loan.jatuhTempo || '-')}</td>
      <td><span class="badge ${statusClasses[loan.status] || 'ringan'}">${statusLabels[loan.status] || 'Status tidak diketahui'}</span></td>
      <td><div class="row-actions">${actions}</div></td>
    </tr>
  `;
  }).join('');
};

const handleSaveLoan = () => {
  const itemSelect = document.getElementById('loanItemSelect');
  const quantityInput = document.getElementById('loanQuantity');
  const classSelect = document.getElementById('loanClassSelect');
  const borrowerInput = document.getElementById('loanBorrower');
  const startInput = document.getElementById('loanStartDate');
  const dueInput = document.getElementById('loanDueDate');
  const notesInput = document.getElementById('loanNotes');

  if (!itemSelect || !quantityInput || !classSelect || !borrowerInput || !startInput || !dueInput) {
    return;
  }

  const items = getCatalog();
  const selectedItem = items.find((item) => item.kode === itemSelect.value);
  if (!selectedItem) {
    showToast('Pilih barang yang valid.');
    return;
  }

  const jumlah = Number(quantityInput.value);
  if (!Number.isSafeInteger(jumlah) || jumlah < 1) {
    showToast('Jumlah barang harus berupa bilangan bulat minimal 1.');
    quantityInput.focus();
    return;
  }

  const borrower = borrowerInput.value.trim();
  const kelas = classSelect.value;
  if (!borrower || !kelas) {
    showToast('Isi nama peminjam terlebih dahulu.');
    return;
  }
  if (!startInput.value || !dueInput.value || dueInput.value < startInput.value) {
    showToast('Isi tanggal pinjam dan pastikan tanggal kembali tidak lebih awal.');
    return;
  }

  const isBorrower = (window.sarprasRole || '').toLowerCase() === 'peminjam';
  const loans = getLoans();
  const newLoan = {
    id: crypto.randomUUID ? crypto.randomUUID() : `loan-${Date.now()}`,
    itemCode: selectedItem.kode,
    itemName: `${selectedItem.kode} - ${selectedItem.nama}`,
    jumlah,
    borrower,
    kelas,
    tanggalPinjam: startInput.value,
    jatuhTempo: dueInput.value,
    notes: notesInput ? notesInput.value.trim() : '',
    status: isBorrower ? 'menunggu_persetujuan' : 'dipinjam',
    createdAt: new Date().toISOString(),
  };

  loans.push(newLoan);
  saveLoans(loans);
  renderLoanRows();
  borrowerInput.value = '';
  notesInput.value = '';
  refreshReturnOptions();
  showToast(isBorrower ? 'Pengajuan peminjaman berhasil dikirim.' : 'Peminjaman berhasil dicatat.');
};

const updateLoanStatus = (id, status) => {
  if (!isLoanManager()) {
    showToast('Hanya admin atau operator yang dapat memproses pengajuan.');
    return;
  }

  const loans = getLoans();
  const target = loans.find((loan) => loan.id === id);
  if (!target || target.status !== 'menunggu_persetujuan') {
    showToast('Pengajuan tidak ditemukan atau sudah diproses.');
    return;
  }

  target.status = status;
  target.processedAt = new Date().toISOString();
  saveLoans(loans);
  renderLoanRows();
  refreshReturnOptions();
  showToast(status === 'dipinjam' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.');
};

const handleReturnLoan = () => {
  const returnSelect = document.getElementById('returnLoanSelect');
  if (!returnSelect || !returnSelect.value) {
    const borrower = document.getElementById('loanBorrower')?.value || '';
    if (!isLoanManager() && !borrower) {
      showToast('Pilih nama peminjam terlebih dahulu.');
    } else if (!isLoanManager()) {
      showToast('Belum ada pinjaman aktif. Tunggu persetujuan admin atau operator.');
    } else {
      showToast('Tidak ada peminjaman aktif yang dipilih.');
    }
    return;
  }

  const loans = getLoans();
  const target = loans.find((loan) => loan.id === returnSelect.value);
  const borrower = document.getElementById('loanBorrower')?.value || '';
  if (!target || target.status !== 'dipinjam'
    || (!isLoanManager() && target.borrower !== borrower)) {
    showToast('Peminjaman aktif tidak ditemukan untuk nama yang dipilih.');
    refreshReturnOptions();
    return;
  }

  const updated = loans.map((loan) => {
    if (loan.id === returnSelect.value) {
      return {
        ...loan,
        status: 'dikembalikan',
        tanggalPengembalian: new Date().toISOString().slice(0, 10),
      };
    }
    return loan;
  });

  saveLoans(updated);
  renderLoanRows();
  refreshReturnOptions();
  showToast('Barang berhasil dikembalikan.');
};

window.addEventListener('DOMContentLoaded', () => {
  const saveLoanButton = document.getElementById('saveLoanButton');
  const returnLoanButton = document.getElementById('returnLoanButton');
  const generateReportButton = document.getElementById('generateReportButton');
  const inventoryForm = document.getElementById('inventoryForm');
  const inventoryModal = document.getElementById('inventoryModal');
  const inventoryCategorySelect = document.getElementById('inventoryKategori');
  const cancelInventoryEdit = document.getElementById('cancelInventoryEdit');
  const addInventoryButton = document.getElementById('addInventoryButton');
  const borrowerClassSelect = document.getElementById('loanClassSelect');

  syncDashboard();
  refreshBorrowerOptions();
  refreshLoanOptions();
  renderLoanRows();
  refreshReturnOptions();

  if (generateReportButton) {
    generateReportButton.addEventListener('click', generateReportSummary);
  }

  if (inventoryForm) {
    inventoryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if ((window.sarprasRole || '').toLowerCase() !== 'admin') return;

      const data = new FormData(inventoryForm);
      const originalItemId = inventoryForm.dataset.originalItemId;
      const catalog = getCatalog();
      const kategori = String(data.get('kategori') || '').trim();
      const savedItem = {
        id: originalItemId || `new-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nama: String(data.get('nama') || '').trim(),
        kategori,
        kode: String(data.get('kode') || '').trim(),
        jumlah: Number(data.get('jumlah')),
        kondisi: String(data.get('kondisi') || '').trim(),
      };

      if (!Number.isSafeInteger(savedItem.jumlah) || savedItem.jumlah < 0) {
        showToast('Jumlah barang harus berupa bilangan bulat minimal 0.');
        inventoryForm.elements.jumlah.focus();
        return;
      }

      if (!INVENTORY_CONDITIONS.includes(savedItem.kondisi)) {
        showToast('Pilih kondisi barang yang valid.');
        inventoryForm.elements.kondisi.focus();
        return;
      }

      if (catalog.some((item) => item.id !== originalItemId
        && item.kode?.toLocaleLowerCase('id') === savedItem.kode.toLocaleLowerCase('id'))) {
        showToast('Kode barang sudah digunakan.');
        inventoryForm.elements.kode.focus();
        return;
      }

      if (catalog.some((item) => item.id !== originalItemId
        && item.nama.toLocaleLowerCase('id') === savedItem.nama.toLocaleLowerCase('id')
        && item.kategori === savedItem.kategori)) {
        showToast('Nama barang sudah ada di kategori tersebut.');
        inventoryForm.elements.nama.focus();
        return;
      }

      const nextCatalog = originalItemId
        ? catalog.map((item) => item.id === originalItemId ? savedItem : item)
        : [...catalog, savedItem];
      if (!saveCatalog(nextCatalog)) return;

      delete inventoryForm.dataset.originalItemId;
      inventoryForm.reset();
      inventoryModal.classList.remove('open');
      syncDashboard();
      document.getElementById('inventoryModalTitle').textContent = 'Edit barang';
      document.getElementById('inventoryModalDescription').textContent = 'Perbarui informasi barang inventaris.';
      document.getElementById('saveInventoryButton').textContent = 'Simpan perubahan';
      showToast(originalItemId ? 'Perubahan barang berhasil disimpan.' : 'Barang baru berhasil ditambahkan.');
    });
  }

  if (addInventoryButton) {
    addInventoryButton.addEventListener('click', addInventoryItem);
  }

  if (inventoryCategorySelect && inventoryForm) {
    inventoryCategorySelect.addEventListener('change', () => {
      inventoryForm.elements.kode.value = getNextInventoryCode(
        getCatalog(),
        inventoryCategorySelect.value,
        inventoryForm.dataset.originalItemId,
      );
    });
  }

  if (cancelInventoryEdit && inventoryModal) {
    cancelInventoryEdit.addEventListener('click', () => {
      inventoryModal.classList.remove('open');
      inventoryForm.reset();
      delete inventoryForm.dataset.originalItemId;
    });
    inventoryModal.addEventListener('click', (event) => {
      if (event.target === inventoryModal) cancelInventoryEdit.click();
    });
  }

  if (saveLoanButton) {
    saveLoanButton.addEventListener('click', handleSaveLoan);
  }

  if (borrowerClassSelect) {
    borrowerClassSelect.addEventListener('change', refreshBorrowerOptions);
  }

  const borrowerSelect = document.getElementById('loanBorrower');
  if (borrowerSelect && borrowerClassSelect) {
    borrowerSelect.addEventListener('change', () => {
      const selectedOption = borrowerSelect.selectedOptions[0];
      const kelas = selectedOption ? selectedOption.dataset.kelas : '';
      if (kelas) {
        borrowerClassSelect.value = kelas.split(' ')[0];
      }
      refreshReturnOptions();
    });
  }

  if (returnLoanButton) {
    returnLoanButton.addEventListener('click', handleReturnLoan);
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const inventoryButton = target.closest('[data-item-id].edit-inventory, [data-item-id].delete-inventory');
    if (inventoryButton instanceof HTMLButtonElement) {
      if (inventoryButton.classList.contains('edit-inventory')) {
        editInventoryItem(inventoryButton.dataset.itemId);
      } else {
        deleteInventoryItem(inventoryButton.dataset.itemId);
      }
    }

    if (target.matches('.return-loan')) {
      const id = target.dataset.id;
      if (id) {
        const returnSelect = document.getElementById('returnLoanSelect');
        if (returnSelect) {
          returnSelect.value = id;
        }
        handleReturnLoan();
      }
    }

    if (target.matches('.approve-loan')) {
      const id = target.dataset.id;
      if (id) updateLoanStatus(id, 'dipinjam');
    }

    if (target.matches('.reject-loan')) {
      const id = target.dataset.id;
      if (id) updateLoanStatus(id, 'ditolak');
    }
  });

});
