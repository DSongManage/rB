#!/bin/bash
# Wrapper to run CRA dev server via socat (bypasses macOS Sequoia localhost restrictions)

cd "$(dirname "$0")"

# Kill any existing processes
pkill -f "react-scripts" 2>/dev/null || true
pkill -f "socat" 2>/dev/null || true
sleep 1

# Check if socat is installed
if ! command -v socat &> /dev/null; then
    echo "Installing socat..."
    brew install socat
fi

# Start CRA in background bound to Unix socket
BROWSER=none PORT=3000 HOST=0.0.0.0 ~/.nvm/versions/node/v18.20.8/bin/npm start &
NPM_PID=$!

echo "Waiting for webpack to compile..."
sleep 10

# Forward Unix socket to TCP
echo "Starting proxy on http://localhost:3000"
socat TCP-LISTEN:3000,reuseaddr,fork TCP:0.0.0.0:3000 &
SOCAT_PID=$!

echo "Dev server running. Press Ctrl+C to stop."
echo "Open http://localhost:3000 in your browser"

# Cleanup on exit
trap "kill $NPM_PID $SOCAT_PID 2>/dev/null" EXIT INT TERM

wait



