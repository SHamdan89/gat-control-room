#!/usr/bin/env node
/**
 * sync_check_to_drive.js
 * Reads ~/sgat/check_results.json and uploads it to a publicly
 * readable Google Drive file so gat.trading can fetch it.
 *
 * SETUP (one-time):
 *   1. Copy this file to ~/sgat/
 *   2. Run: node ~/sgat/sync_check_to_drive.js
 *   3. Copy the printed DRIVE_FILE_ID into gat.trading src/App.jsx
 *      (the CHECK_RESULTS_DRIVE_ID constant)
 *   4. Add cron job to run after each check:
 *        * * * * * cd ~/sgat && node sync_check_to_drive.js >> /tmp/sync_check.log 2>&1
 *
 * CREDENTIALS:
 *   This script auto-detects your service account key by checking the same
 *   paths report_generator.js uses. Override by setting:
 *     export GOOGLE_KEY_FILE=/path/to/service-account-key.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Credential discovery ───────────────────────────────────────────────────
// Checks the same locations report_generator.js typically uses
const KEY_CANDIDATES = [
  process.env.GOOGLE_KEY_FILE,
  path.join(__dirname, 'service-account-key.json'),
  path.join(__dirname, 'credentials.json'),
  path.join(__dirname, 'google-credentials.json'),
  path.join(__dirname, 'key.json'),
  path.join(process.env.HOME || '~', '.config', 'gcloud', 'application_default_credentials.json'),
];

function findKeyFile() {
  for (const p of KEY_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// ── Config file — stores the Drive file ID after first run ─────────────────
const CONFIG_PATH = path.join(__dirname, '.check_drive_id');

function loadFileId() {
  try { return fs.readFileSync(CONFIG_PATH, 'utf8').trim(); } catch { return null; }
}

function saveFileId(id) {
  fs.writeFileSync(CONFIG_PATH, id, 'utf8');
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read check_results.json
  const checkPath = path.join(__dirname, 'check_results.json');
  if (!fs.existsSync(checkPath)) {
    console.error(`[sync_check] ERROR: ${checkPath} not found`);
    process.exit(1);
  }
  const checkData = JSON.parse(fs.readFileSync(checkPath, 'utf8'));
  console.log(`[sync_check] Read check_results.json — passed:${checkData.passed} failed:${checkData.failed} warnings:${checkData.warnings}`);

  // 2. Find credentials
  const keyFile = findKeyFile();
  if (!keyFile) {
    console.error('[sync_check] ERROR: No service account key file found.');
    console.error('Set GOOGLE_KEY_FILE=/path/to/key.json or place key.json in ~/sgat/');
    process.exit(1);
  }
  console.log(`[sync_check] Using credentials: ${keyFile}`);

  // 3. Auth
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // 4. Upload content
  const content = JSON.stringify(checkData, null, 2);
  const { Readable } = require('stream');
  const bodyStream = Readable.from([content]);

  let fileId = loadFileId();

  if (fileId) {
    // Update existing file
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: bodyStream },
    });
    console.log(`[sync_check] Updated Drive file: ${fileId}`);
  } else {
    // Create new file
    const res = await drive.files.create({
      requestBody: { name: 'gat_check_results.json', mimeType: 'application/json' },
      media:       { mimeType: 'application/json', body: bodyStream },
      fields: 'id',
    });
    fileId = res.data.id;
    saveFileId(fileId);

    // Make it publicly readable (no sign-in required)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    console.log(`\n✅ Created public Drive file!`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   Fetch URL: https://drive.google.com/uc?export=download&id=${fileId}`);
    console.log(`\n👉 NEXT STEP: Open src/App.jsx and set:`);
    console.log(`   const CHECK_RESULTS_DRIVE_ID = "${fileId}";\n`);
  }

  console.log(`[sync_check] Done at ${new Date().toISOString()}`);
}

main().catch(e => {
  console.error('[sync_check] FATAL:', e.message);
  process.exit(1);
});
