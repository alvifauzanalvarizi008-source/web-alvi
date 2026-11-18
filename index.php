<?php
require_once __DIR__ . "/auth.php";

if (!empty($_SESSION["sarpras_user"])) {
    header("Location: dasboad.php");
    exit;
}

header("Location: login.php");
exit;
