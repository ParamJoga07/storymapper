#!/usr/bin/env bash
# Start backend (:3001) and frontend (:5173) together. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"

(cd prd_be && npm start) &
BE_PID=$!
(cd prd_fe/prd-fe && npm run dev) &
FE_PID=$!

trap 'kill $BE_PID $FE_PID 2>/dev/null' EXIT INT TERM
wait
