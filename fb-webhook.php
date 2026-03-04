<?php
// 1. Verification Token (Jo aap Meta Dashboard mein likhenge)
$verify_token = "my_secret_crm_123"; 

if ($_REQUEST['hub_mode'] === 'subscribe' && $_REQUEST['hub_verify_token'] === $verify_token) {
    echo $_REQUEST['hub_challenge'];
    exit;
}

// 2. Message Receive karne ka logic (Baad mein yahan kaam karenge)
$data = json_decode(file_get_contents('php://input'), true);
file_put_contents('log.txt', print_r($data, true)); // Testing ke liye logs
?>