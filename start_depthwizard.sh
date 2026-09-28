#!/usr/bin/env bash
# DepthWizard - 1-Click Standalone Desktop Launcher (Linux / macOS)
set -e

echo "========================================================"
echo "       🚀 DepthWizard - Standalone Launcher"
echo " High-Precision Elevation Estimation & 3D Reconstruction"
echo "========================================================"

# Start backend
python3 backend/main.py &
BACKEND_PID=$!

# Start frontend
cd frontend-react && npm start &
FRONTEND_PID=$!
cd ..

sleep 5
echo "Opening DepthWizard in default browser..."
if which xdg-open > /dev/null; then
  xdg-open http://localhost:3000
elif which open > /dev/null; then
  open http://localhost:3000
fi

echo "DepthWizard running locally (Air-Gapped & Offline)."
wait $BACKEND_PID $FRONTEND_PID
