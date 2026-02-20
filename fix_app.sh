#!/bin/bash
set -e

echo "==========================================="
echo "   REPAIRING PROCUREMENT APP ENVIRONMENT   "
echo "==========================================="

echo "[1/4] Stopping running services..."
# Kill existing vite/uvicorn processes to free ports
pkill -f "vite" || true
pkill -f "uvicorn" || true
pkill -f "python -m uvicorn" || true

echo "[2/4] Cleaning corrupted dependencies and cache..."
# Remove potential sources of conflict
rm -rf node_modules package-lock.json dist .vite frontend.log backend.log

echo "[3/4] Reinstalling dependencies (this may take a minute)..."
# Clean install
npm install

echo "[4/4] Starting Application..."
echo "-------------------------------------------"
# Run the start script
sh start_app.sh
