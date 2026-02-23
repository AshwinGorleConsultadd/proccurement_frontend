#!/bin/bash
echo "Setting up Python Virtual Environment..."

# Locate python3
PY_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PY_CMD="python"
fi

# Create venv if not exists
if [ ! -d "venv" ]; then
    echo "Creating 'venv' directory..."
    $PY_CMD -m venv venv
else
    echo "'venv' already exists."
fi

# Install dependencies using the venv's pip
echo "Installing/Updating backend dependencies..."
./venv/bin/pip install -r backend/requirements.txt

echo "---------------------------------------------------"
echo "Virtual Environment Setup Complete!"
echo "dependency installation successful."
echo "---------------------------------------------------"
