/**
 * report_generator.js — GAT Mac Mini
 * Lives at: /Users/mgat.agent/sgat/report_generator.js
 *
 * ADDITIONS vs previous version (May 2026):
 *   • writeCheckResultsToDrive() — pushes check_results.json to Drive
 *   • argv handler: "sync_check" mode
 *
 * These blocks are meant to be merged into the existing file.
 * Search for the markers ── INSERT AFTER LINE 230 ── and ── INSERT IN ARGV HANDLER ──
 */

'use strict';

const { google } = require('googleapis');
const fs         = require('fs');
const path       = require('path');

// ── Shared config ────────────────────────────────────────────────────────────
const KEY_FILE        = '/Users/mgat.agent/sgat/credentials/gdrive-key.json';
const CHECK_FILE_ID   = '1FEnlk1wK45An9zIjXBWujpYAM3h4iU-_xgxTC-2u7bY';
const CHECK_JSON_PATH = path.join(__dirname, 'check_results.json');

// ── INSERT AFTER LINE 230 (after the existing writeToDrive function) ──────────

/**
 * writeCheckResultsToDrive()
 * Reads ~/sgat/check_results.json and writes it as plain JSON to the
 * SGAT_Mac Mini_Daily_Check_Report Drive file.
 * Auth pattern is identical to the existing writeToDrive().
 */
async function writeCheckResultsToDrive() {
  if (!fs.existsSync(CHECK_JSON_PATH)) {
    console.error(`[writeCheckResultsToDrive] File not found: ${CHECK_JSON_PATH}`);
    process.exit(1);
  }

  const raw    = fs.readFileSync(CHECK_JSON_PATH, 'utf8');
  const parsed = JSON.parse(raw);           // validate it's real JSON

  // Write as plain text so the Docs export URL returns CORS-safe content
  const textContent = [
    `PASSED: ${parsed.passed}`,
    `FAILED: ${parsed.failed}`,
    `WARNINGS: ${parsed.warnings ?? 0}`,
    `STATUS: ${parsed.all_systems_go ? 'ALL SYSTEMS GO' : parsed.failed > 0 ? 'FAILURES' : 'WARNINGS'}`,
    `TIMESTAMP: ${parsed.timestamp}`,
  ].join('\n');

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes:  ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const { Readable } = require('stream');

  await drive.files.update({
    fileId: CHECK_FILE_ID,
    media:  {
      mimeType: 'text/plain',
      body:     Readable.from([textContent]),
    },
  });

  console.log(`[writeCheckResultsToDrive] OK — passed:${parsed.passed} failed:${parsed.failed} warnings:${parsed.warnings} at ${parsed.timestamp}`);
}

// ── INSERT IN ARGV HANDLER ────────────────────────────────────────────────────
// Add this case alongside the existing argv cases (e.g. next to 'generate', 'send', etc.)

const mode = process.argv[2];

if (mode === 'sync_check') {
  writeCheckResultsToDrive().catch(e => {
    console.error('[sync_check] FATAL:', e.message);
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO MERGE:
//
// 1. Open /Users/mgat.agent/sgat/report_generator.js
//
// 2. After the existing writeToDrive() function (~line 230), paste:
//      • The KEY_FILE / CHECK_FILE_ID / CHECK_JSON_PATH constants
//        (if not already defined at the top of the file)
//      • The entire writeCheckResultsToDrive() function above
//
// 3. In the existing process.argv switch/if-else block, add:
//      else if (mode === 'sync_check') {
//        writeCheckResultsToDrive().catch(e => { console.error(e); process.exit(1); });
//      }
//
// 4. Save. Test manually:
//      node /Users/mgat.agent/sgat/report_generator.js sync_check
//
// 5. Then run_check_and_save.sh calls it automatically (see that file).
// ─────────────────────────────────────────────────────────────────────────────
