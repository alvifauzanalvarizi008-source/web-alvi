<?php
require_once __DIR__ . "/auth.php";

if (!empty($_SESSION["sarpras_user"])) {
    header("Location: dasboad.php");
    exit;
}

if (empty($_SESSION["login_csrf"])) {
    $_SESSION["login_csrf"] = bin2hex(random_bytes(32));
}

$error = "";
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $csrf = $_POST["csrf"] ?? "";
    $username = $_POST["username"] ?? "";
    $password = $_POST["password"] ?? "";

    if (!is_string($csrf) || !hash_equals($_SESSION["login_csrf"], $csrf)) {
        $error = "Sesi formulir tidak valid. Muat ulang halaman dan coba lagi.";
    } elseif (
        is_string($username)
        && is_string($password)
        && sarpras_verify_login($username, $password)
    ) {
        $role = strtolower(trim($username));
        if ($role === "siswa") {
            $role = "peminjam";
        }
        session_regenerate_id(true);
        $_SESSION["sarpras_user"] = $role === "peminjam" ? "Siswa" : ucfirst($role);
        $_SESSION["sarpras_role"] = $role;
        unset($_SESSION["login_csrf"]);
        header("Location: dasboad.php");
        exit;
    } else {
        $error = "Nama pengguna atau kata sandi salah.";
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login | Inventaris Sarpras</title>
  <link rel="stylesheet" href="login.css">
</head>
<body>
  <main class="login-page">
    <section class="login-card">
      <a class="brand" href="login.php" aria-label="Inventaris Sarpras">
        <img class="brand-icon" src="smk%20bn.jpeg" alt="Lambang SMK">
        <span><strong>SARPRAS SMK</strong><small>Sistem Inventaris Sekolah</small></span>
      </a>
      <div class="login-heading">
        <h1>Selamat datang</h1>
        <p>Masuk untuk mengelola inventaris sekolah.</p>
      </div>
      <?php if ($error !== ""): ?>
        <div class="error-message" role="alert"><?= e($error) ?></div>
      <?php endif; ?>
      <form method="post" class="login-form">
        <input type="hidden" name="csrf" value="<?= e($_SESSION["login_csrf"]) ?>">
        <label for="username">Nama pengguna</label>
        <input id="username" name="username" type="text" autocomplete="username" placeholder="Masukkan nama pengguna" required autofocus>
        <label for="password">Kata sandi</label>
        <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required>
        <button type="submit">Masuk ke dashboard <span aria-hidden="true">→</span></button>
      </form>
      <p class="login-help">Gunakan akun admin, operator, atau siswa untuk melanjutkan.<br>Akun siswa: siswa / siswa123</p>
    </section>
    <footer>Inventaris Sarana &amp; Prasarana Sekolah</footer>
  </main>
</body>
</html>
