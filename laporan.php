<?php
require_once __DIR__ . "/auth.php";

if (empty($_SESSION["sarpras_user"])) {
    header("Location: login.php");
    exit;
}

require __DIR__ . "/data-barang.php";

$currentRole = strtolower((string) ($_SESSION["sarpras_role"] ?? "admin"));
if (!in_array($currentRole, ["admin", "operator", "peminjam"], true)) {
    $_SESSION = [];
    session_destroy();
    header("Location: login.php");
    exit;
}
if (!in_array($currentRole, ["admin", "operator"], true)) {
    header("Location: dasboad.php");
    exit;
}
$kategoriBarangJson = file_get_contents(__DIR__ . "/kategori-barang.json");
if ($kategoriBarangJson === false) {
    throw new RuntimeException("Katalog barang tidak dapat dibaca.");
}
$kategoriBarangData = json_decode($kategoriBarangJson, true, 512, JSON_THROW_ON_ERROR);
if (!isset($kategoriBarangData["kategori"]) || !is_array($kategoriBarangData["kategori"])) {
    throw new RuntimeException("Format katalog barang tidak valid.");
}
$kategoriBarang = $kategoriBarangData["kategori"];
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Laporan Inventaris Sarpras</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
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
      <a class="nav-link" href="dasboad.php"><span class="icon">▦</span>Dashboard</a>
      <a class="nav-link active" href="laporan.php"><span class="icon">▥</span>Laporan</a>
      <a class="nav-link" href="logout.php"><span class="icon">↪</span>Logout</a>
    </nav>
    <div class="sidebar-bottom"><strong>Inventaris Sarana &amp; Prasarana</strong><br>Laporan kondisi barang sekolah.</div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div class="breadcrumb"><strong>Dashboard</strong></div>
      <div class="profile"><div><strong><?= e($currentRole === "peminjam" ? "Siswa" : $_SESSION["sarpras_user"]) ?></strong><small><?= e($currentRole === "peminjam" ? "Siswa" : ($currentRole === "operator" ? "Operator" : "Pengelola sarpras")) ?></small></div></div>
    </header>

    <div class="content">
      <section class="heading">
        <div><h1>Laporan Inventaris</h1><p>Ringkasan dan daftar seluruh barang sarana prasarana sekolah.</p></div>
        <button class="button" type="button" onclick="window.print()">Cetak laporan</button>
      </section>

      <?php if ($currentRole === "admin"): ?>
      <section class="card shadow-sm border-0 mb-4" id="weeklyReport">
        <div class="card-header bg-white border-bottom-0 d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 p-md-4">
          <div><h2 class="h5 mb-1">Laporan peminjaman mingguan</h2><p class="text-secondary mb-0" id="weeklyReportRange">Pilih minggu untuk melihat transaksi.</p></div>
          <div class="d-flex flex-wrap align-items-end gap-2 weekly-report-controls">
            <label class="form-label mb-1" for="reportWeek">Pilih minggu</label>
            <input class="form-control" id="reportWeek" type="week">
          </div>
        </div>
        <div class="card-body pt-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover align-middle mb-0">
              <thead><tr><th>TGL PINJAM</th><th>KODE / BARANG</th><th>JUMLAH</th><th>PEMINJAM</th><th>KELAS</th><th>JATUH TEMPO</th><th>STATUS</th><th class="weekly-actions">AKSI</th></tr></thead>
              <tbody id="weeklyReportRows"></tbody>
            </table>
            <div class="alert alert-info m-3" id="weeklyReportEmpty" hidden>Tidak ada transaksi peminjaman pada minggu ini.</div>
          </div>
        </div>
      </section>
      <?php endif; ?>

      <section class="panel table-panel">
        <div class="table-head">
          <div><h2>Daftar barang inventaris</h2><p>Daftar barang ini mengikuti katalog Inventarisir barang.</p></div>
          <div class="table-tools">
            <input class="search" id="reportSearch" type="search" placeholder="Cari nama, kode, kategori..." aria-label="Cari laporan">
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>KODE</th><th>KATEGORI</th><th>NAMA BARANG</th><th>JUMLAH BARANG</th><th>KONDISI</th><th>AKSI</th></tr></thead>
            <tbody id="reportRows"></tbody>
          </table>
          <div class="empty" id="reportEmpty" hidden>Tidak ada barang yang sesuai dengan pencarian.</div>
        </div>
        <div class="table-foot" id="reportCount">Memuat laporan...</div>
      </section>
    </div>
  </main>
</div>
<script>window.sarprasInitialItems = <?= json_encode($barangAwal, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>; window.sarprasInitialCatalog = <?= json_encode($kategoriBarang, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>; window.sarprasRole = <?= json_encode($currentRole) ?>;</script>
<script src="laporan.js?v=<?= filemtime(__DIR__ . "/laporan.js") ?>" defer></script>
</body>
</html>
