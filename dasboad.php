<?php
require_once __DIR__ . "/auth.php";

if (empty($_SESSION["sarpras_user"])) {
    header("Location: login.php");
    exit;
}

if (!in_array(strtolower((string) ($_SESSION["sarpras_role"] ?? "")), ["admin", "operator", "peminjam"], true)) {
    $_SESSION = [];
    session_destroy();
    header("Location: login.php");
    exit;
}

require __DIR__ . "/data-barang.php";

$currentRole = strtolower((string) ($_SESSION["sarpras_role"] ?? "admin"));
$kategoriBarangJson = file_get_contents(__DIR__ . "/kategori-barang.json");
if ($kategoriBarangJson === false) {
    throw new RuntimeException("Katalog barang tidak dapat dibaca.");
}
$kategoriBarangData = json_decode($kategoriBarangJson, true, 512, JSON_THROW_ON_ERROR);
if (!isset($kategoriBarangData["kategori"]) || !is_array($kategoriBarangData["kategori"])) {
    throw new RuntimeException("Format katalog barang tidak valid.");
}
$kategoriBarang = $kategoriBarangData["kategori"];

$daftarPeminjamJson = file_get_contents(__DIR__ . "/daftar-peminjam.json");
if ($daftarPeminjamJson === false) {
    throw new RuntimeException("Daftar peminjam tidak dapat dibaca.");
}
$daftarPeminjam = json_decode($daftarPeminjamJson, true, 512, JSON_THROW_ON_ERROR);
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inventaris Sarana dan Prasarana</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <img class="brand-icon" src="smk%20bn.jpeg" alt="Lambang SMK">
      <div><strong>SARPRAS SMK</strong><small>Sistem Inventaris Sekolah</small></div>
    </div>
    <div class="nav-label">Menu utama</div>
    <nav aria-label="Navigasi utama">
      <a class="nav-link active" href="#dashboard"><span class="icon">▦</span>Dashboard</a>
      <?php if ($currentRole === "admin"): ?>
        <a class="nav-link" href="#inventaris"><span class="icon">▤</span>Inventarisir</a>
      <?php endif; ?>
      <a class="nav-link" href="#peminjaman"><span class="icon">⇄</span>Peminjaman</a>
      <a class="nav-link" href="#pengembalian"><span class="icon">↺</span>Pengembalian</a>
      <?php if ($currentRole === "admin"): ?>
        <a class="nav-link" href="#laporan-admin"><span class="icon">▥</span>Generate laporan</a>
      <?php endif; ?>
      <?php if (in_array($currentRole, ["admin", "operator"], true)): ?>
        <a class="nav-link" href="laporan.php"><span class="icon">◉</span>Laporan</a>
      <?php endif; ?>
      <a class="nav-link" href="logout.php"><span class="icon">↪</span>Logout</a>
    </nav>
  </aside>

  <main class="main" id="dashboard">
    <header class="topbar">
      <div class="breadcrumb"><strong>Dashboard</strong></div>
      <div class="profile"><div><strong><?= e($currentRole === "peminjam" ? "Siswa" : $_SESSION["sarpras_user"]) ?></strong><small><?= e($currentRole === "peminjam" ? "Siswa" : ($currentRole === "operator" ? "Operator" : "Pengelola sarpras")) ?></small></div></div>
    </header>

    <div class="content">
      <section class="heading">
        <div><h1>Inventaris Sarana dan Prasarana</h1><p>Pantau aset dan sarana prasarana sekolah.</p></div>
      </section>

      <section class="stats" aria-label="Ringkasan inventaris">
        <article class="stat-card"><div><span class="stat-label">Total barang</span><strong class="stat-value" id="totalBarang">0</strong><div class="stat-note">Unit inventaris tercatat</div></div><div class="stat-icon">▤</div></article>
        <article class="stat-card"><div><span class="stat-label">Kondisi baik</span><strong class="stat-value" id="totalBaik">0</strong><div class="stat-note">Siap digunakan</div></div><div class="stat-icon">✓</div></article>
        <article class="stat-card"><div><span class="stat-label">Rusak ringan</span><strong class="stat-value" id="totalRingan">0</strong><div class="stat-note">Perlu perbaikan ringan</div></div><div class="stat-icon">!</div></article>
        <article class="stat-card"><div><span class="stat-label">Rusak berat</span><strong class="stat-value" id="totalBerat">0</strong><div class="stat-note">Perlu tindak lanjut</div></div><div class="stat-icon">×</div></article>
      </section>

      <?php if ($currentRole === "admin"): ?>
        <section class="panel table-panel" id="inventaris">
          <div class="table-head">
            <div><h2>Inventarisir barang</h2><p>Katalog barang sarana dan prasarana berdasarkan kategori.</p></div>
            <div class="table-actions">
              <button class="button" type="button" id="addInventoryButton">Tambah barang</button>
              <button class="button secondary" type="button" onclick="window.print()">Cetak daftar</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>KODE</th><th>KATEGORI</th><th>NAMA BARANG</th><th>JUMLAH</th><th>KONDISI</th><th>AKSI</th></tr></thead>
              <tbody id="inventoryRows"></tbody>
            </table>
          </div>
          <div class="table-foot" id="inventoryCount">Memuat data inventaris...</div>
        </section>
      <?php endif; ?>

      <section class="panel table-panel" id="peminjaman">
        <div class="table-head">
          <div><h2>Manajemen peminjaman</h2><p><?= $currentRole === "peminjam" ? "Ajukan peminjaman barang. Pengajuan menunggu persetujuan admin atau operator." : "Catat peminjaman atau tinjau pengajuan dari akun siswa." ?></p></div>
        </div>
        <?php if ($currentRole === "peminjam"): ?>
          <div class="table-foot" style="border-top: 0; padding-top: 0;">Akun siswa digunakan bersama. Pilih nama sesuai identitas; sistem belum memverifikasi identitas siswa secara otomatis.</div>
        <?php endif; ?>
        <div class="form-grid" style="padding: 0 20px 20px;">
          <div class="field">
            <label for="loanItemSelect">Barang</label>
            <select id="loanItemSelect" required></select>
          </div>
          <div class="field">
            <label for="loanQuantity">Jumlah barang</label>
            <input id="loanQuantity" type="number" min="1" step="1" value="1" required>
          </div>
          <div class="field">
            <label for="loanClassSelect">Kelas</label>
            <select id="loanClassSelect" required>
              <option value="">Pilih kelas</option>
              <option>X</option><option>XI</option><option>XII</option>
            </select>
          </div>
          <div class="field">
            <label for="loanBorrower">Nama peminjam</label>
            <select id="loanBorrower" required>
              <option value="">Memuat daftar nama...</option>
            </select>
          </div>
          <div class="field">
            <label for="loanStartDate">Tanggal pinjam</label>
            <input id="loanStartDate" type="date" required>
          </div>
          <div class="field">
            <label for="loanDueDate">Tanggal kembali</label>
            <input id="loanDueDate" type="date" required>
          </div>
          <div class="field full">
            <label for="loanNotes">Catatan</label>
            <input id="loanNotes" type="text" placeholder="Contoh: dipinjam untuk praktik">
          </div>
        </div>
        <div class="modal-actions" style="padding: 0 20px 20px;">
          <button type="button" class="button" id="saveLoanButton"><?= $currentRole === "peminjam" ? "Ajukan peminjaman" : "Catat peminjaman" ?></button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>BARANG</th><th>JUMLAH</th><th>PEMINJAM</th><th>KELAS</th><th>TGL PINJAM</th><th>JATUH TEMPO</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody id="loanRows"></tbody>
          </table>
        </div>
      </section>

      <section class="panel" id="pengembalian">
        <div class="panel-title">
          <div><h2>Pengembalian barang</h2><p><?= $currentRole === "peminjam" ? "Pilih nama peminjam pada formulir. Pengajuan harus disetujui admin atau operator sebelum barang dapat dikembalikan." : "Proses barang yang sudah dikembalikan." ?></p></div>
        </div>
        <div class="form-grid">
          <div class="field full">
            <label for="returnLoanSelect">Peminjaman aktif</label>
            <select id="returnLoanSelect"></select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="button" id="returnLoanButton">Konfirmasi pengembalian</button>
        </div>
      </section>

      <?php if ($currentRole === "admin"): ?>
        <section class="panel" id="laporan-admin">
          <div class="panel-title">
            <div><h2>Generate laporan</h2><p>Buat ringkasan inventaris dan peminjaman.</p></div>
            <button type="button" class="button" id="generateReportButton">Generate laporan</button>
          </div>
          <div class="summary-box" id="reportSummary">Klik tombol untuk membuat laporan.</div>
        </section>
      <?php endif; ?>
    </div>
  </main>
</div>

<div class="toast" id="toast" role="status"></div>

<?php if ($currentRole === "admin"): ?>
  <div class="modal-backdrop" id="inventoryModal" role="dialog" aria-modal="true" aria-labelledby="inventoryModalTitle">
    <form class="modal" id="inventoryForm">
      <h2 id="inventoryModalTitle">Edit barang</h2>
      <p id="inventoryModalDescription">Perbarui informasi barang inventaris.</p>
      <div class="form-grid">
        <div class="field full"><label for="inventoryKode">Kode barang</label><input id="inventoryKode" name="kode" required autocomplete="off"></div>
        <div class="field full"><label for="inventoryKategori">Kategori</label><select id="inventoryKategori" name="kategori" required>
          <?php foreach ($kategoriBarang as $kategori): ?>
            <option value="<?= e($kategori["nama"]) ?>"><?= e($kategori["nama"]) ?></option>
          <?php endforeach; ?>
        </select></div>
        <div class="field full"><label for="inventoryNama">Nama barang</label><input id="inventoryNama" name="nama" required></div>
        <div class="field full"><label for="inventoryJumlah">Jumlah barang</label><input id="inventoryJumlah" name="jumlah" type="number" min="0" step="1" value="0" required></div>
        <div class="field full"><label for="inventoryKondisi">Kondisi barang</label><select id="inventoryKondisi" name="kondisi" required>
          <option value="Baik">Baik</option>
          <option value="Rusak Ringan">Rusak ringan</option>
          <option value="Rusak Berat">Rusak berat</option>
        </select></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="button secondary" id="cancelInventoryEdit">Batal</button>
        <button type="submit" class="button" id="saveInventoryButton">Simpan perubahan</button>
      </div>
    </form>
  </div>
<?php endif; ?>

  <script>window.sarprasInitialItems = <?= json_encode($barangAwal, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>; window.sarprasInitialCatalog = <?= json_encode($kategoriBarang, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>; window.sarprasRole = <?= json_encode($currentRole) ?>; window.sarprasBorrowers = <?= json_encode($daftarPeminjam, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;</script>
  <script src="dashboard.js?v=<?= filemtime(__DIR__ . "/dashboard.js") ?>" defer></script>
</body>
</html>