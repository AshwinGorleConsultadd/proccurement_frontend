#!/bin/bash

# Ensure virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment (venv) not found. Running setup first..."
    sh setup_env.sh
    if [ ! -f "venv/bin/python" ]; then
        echo "Failed to create virtual environment. Aborting."
        exit 1
    fi
fi

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Procurement & Co. Application..."

# Use venv python
VENV_PYTHON="./venv/bin/python"

# Start Backend (prints to terminal)
echo "Starting Backend on port 8000..."
(cd backend && ../$VENV_PYTHON -m uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

# Wait briefly
sleep 3

# Start Frontend (prints to terminal)
echo "Starting Frontend..."
npm run dev &
FRONTEND_PID=$!

echo "---------------------------------------------------"
echo "Application is running! Logs will appear below."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop."
echo "---------------------------------------------------"
# Attempt to open browser
if command -v open &> /dev/null; then
    open "http://localhost:5173"
fi

wait
