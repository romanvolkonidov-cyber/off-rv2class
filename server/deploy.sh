#!/usr/bin/env bash
set -euo pipefail

# --- CONFIGURATION ---
SERVER_IP="158.220.94.77" # Based on neighbor config
SSH_USER="trader"         # Based on neighbor config
REMOTE_DIR="/home/trader/rv2class/server"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying rv2class SERVER to $SERVER_IP..."

# 1. Sync project to server
echo "📦 Uploading server files..."
rsync -av --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude node_modules \
  --exclude .git \
  --exclude dev.db \
  --exclude "*cache*" \
  --exclude uploads \
  "$LOCAL_DIR/" "${SSH_USER}@${SERVER_IP}:'${REMOTE_DIR}/'"

# 2. Remote Setup
echo "🛠️ Setting up environment on remote..."
ssh -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_IP}" \
  REMOTE_DIR="$REMOTE_DIR" \
  bash -s <<'REMOTE'
set -e

# Ensure Node via nvm
if [ ! -d ~/.nvm ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22

echo "🔐 Installing dependencies..."
cd "$REMOTE_DIR"
npm install

echo "🔄 Running Prisma Migrations..."
npx prisma db push
npx prisma generate

echo "🤖 Restarting Express Server via PM2..."
# Kill any potential conflicts
pm2 delete rv2class-server 2>/dev/null || true

# Start via PM2
pm2 start npm --name rv2class-server --cwd "$REMOTE_DIR" -- run dev
pm2 save

echo "📊 Current PM2 Status:"
pm2 list

echo "✅ Remote Server Setup Complete!"
REMOTE

echo "✅ Deployment Finished!"
