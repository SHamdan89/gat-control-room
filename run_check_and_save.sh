#!/bin/bash
# run_check_and_save.sh — GAT Mac Mini
# Lives at: /Users/mgat.agent/sgat/run_check_and_save.sh
#
# This file shows the ONE LINE to add at the end of the existing script.
# Do not replace the whole file — just append the last line.
#
# ── ADD THIS LINE AT THE END OF THE EXISTING run_check_and_save.sh ──────────

/opt/homebrew/opt/node@22/bin/node /Users/mgat.agent/sgat/report_generator.js sync_check
