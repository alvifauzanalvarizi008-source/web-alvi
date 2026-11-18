<?php
$host = "localhost";
$username = "root";
$password = "";
$database = "SARANA_PRASARAN";

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $koneksi = new mysqli($host, $username, $password, $database);
    $koneksi->set_charset("utf8mb4");
} catch (mysqli_sql_exception $exception) {
    error_log("Koneksi database gagal: " . $exception->getMessage());
    http_response_code(500);
    exit("Koneksi ke database gagal. Periksa konfigurasi database.");
}
