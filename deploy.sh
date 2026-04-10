#!/usr/bin/env bash
set -euo pipefail

# --- CONFIGURATION ---
SERVER_IP="158.220.94.77"
SSH_USER="trader"
REMOTE_DIR="/home/trader/rv2class-api"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=4000

echo "🚀 Deploying rv2class BACKEND to http://$SERVER_IP:$PORT..."

# 1. Sync project to server (Server folder ONLY)
echo "📦 Uploading files via RSYNC..."
rsync -av --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude node_modules \
  --exclude dev.db \
  --exclude "*cache*" \
  "$LOCAL_DIR/server/" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/"

# 2. Execute on remote
echo "🛠 Building and Restarting API via SSH..."
ssh -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" << 'EOF'
  set -e
  
  export REMOTE_DIR="/home/trader/rv2class-api"
  
  cd $REMOTE_DIR
  
  export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"
  
  echo "📦 Installing npm dependencies..."
  npm install

  echo "📂 Creating necessary folders..."
  mkdir -p uploads/temp

  echo "🗄 Updating Prisma..."
  npx prisma generate
  npx prisma db push --accept-data-loss

  echo "🏗️ Building TypeScript to JavaScript..."
  npm run build

  echo "🔄 Restarting API via pm2..."
  if ! command -v pm2 &> /dev/null
  then
      echo "⚠️ PM2 not found, installing it globally..."
      npm install -g pm2
  fi
  
  pm2 delete rv2class-api || true
  pm2 start "npm start" --name "rv2class-api" --update-env
  pm2 save
  
  echo "🔥 Opening Firewall (Port 4000)..."
  echo "1401" | sudo -S ufw allow 4000/tcp || echo "⚠️ Could not run ufw, skipping..."

  echo "👤 Initializing Admin and Demo Users..."
  npm run init-admin

  echo "✅ BACKEND SUCCESSFULLY DEPLOYED!"
EOF

echo "🎉 Done! API is live."
