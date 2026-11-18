<?php
$kategoriBarangJson = file_get_contents(__DIR__ . "/kategori-barang.json");
if ($kategoriBarangJson === false) {
    throw new RuntimeException("Katalog barang tidak dapat dibaca.");
}

$kategoriBarangData = json_decode($kategoriBarangJson, true, 512, JSON_THROW_ON_ERROR);
if (!isset($kategoriBarangData["kategori"]) || !is_array($kategoriBarangData["kategori"])) {
    throw new RuntimeException("Format katalog barang tidak valid.");
}

$barangAwal = [];
foreach ($kategoriBarangData["kategori"] as $kategori) {
    if (!isset($kategori["kode"], $kategori["nama"], $kategori["barang"]) || !is_array($kategori["barang"])) {
        throw new RuntimeException("Format kategori inventaris tidak valid.");
    }

    foreach ($kategori["barang"] as $barang) {
        if (!isset($barang["nomor"], $barang["nama"]) || !is_numeric($barang["nomor"])) {
            throw new RuntimeException("Format barang inventaris tidak valid.");
        }

        $nomor = (int) $barang["nomor"];
        $kodeKategori = (string) $kategori["kode"];
        $barangAwal[] = [
            "id" => $kodeKategori . "-" . $nomor,
            "kode" => $kodeKategori . "-" . str_pad((string) $nomor, 3, "0", STR_PAD_LEFT),
            "nama" => (string) $barang["nama"],
            "kategori" => (string) $kategori["nama"],
            "ruangan" => "",
            "jumlah" => 0,
            "kondisi" => "Baik",
        ];
    }
}
