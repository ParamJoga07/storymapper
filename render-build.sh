#!/usr/bin/env bash
# Render build: install backend deps, then build the frontend into
# prd_fe/prd-fe/dist (served statically by the backend in production).
set -euo pipefail

echo "==> Installing backend dependencies"
cd prd_be
npm ci || npm install
cd ..

echo "==> Building frontend"
cd prd_fe/prd-fe
npm ci || npm install
npm run build
cd ../..

echo "==> Build complete"
