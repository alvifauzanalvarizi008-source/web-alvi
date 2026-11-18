<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        "httponly" => true,
        "samesite" => "Lax",
    ]);
    session_start();
}

const SARPRAS_USERS = [
    "admin" => '$2y$10$b2FNEpUGKCzB3EVhOujBR.CpKb3LaoBPculO5BjpSpTy8nKv17AIK',
    "operator" => '$2y$10$ZBdUcKSjRyZg5xk2/pAVKeSEaeVDtFogS3BGinR.WP5dLUVfatvSS',
    "siswa" => '$2y$10$eu42Dd2oWQa0mN0G5Oe6nOprlqBG.N5Fetoi5X6EZHkV/yJedh1tO',
];

function sarpras_verify_login(string $username, string $password): bool
{
    $normalizedUsername = strtolower(trim($username));
    if (!isset(SARPRAS_USERS[$normalizedUsername])) {
        return false;
    }

    return password_verify($password, SARPRAS_USERS[$normalizedUsername]);
}

function e($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, "UTF-8");
}
