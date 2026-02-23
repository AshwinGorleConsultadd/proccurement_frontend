#!/bin/bash
echo "Installing dependencies..."
echo "1. Installing Frontend dependencies (npm)..."
npm install
echo "Done."

echo "2. Installing Backend dependencies (pip)..."
# Check if python3 is available
PY_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PY_CMD="python"
fi
$PY_CMD -m pip install -r backend/requirements.txt
echo "Done."

echo "---------------------------------------------------"
echo "Setup complete! You can now run start_app.sh"
echo "---------------------------------------------------"
