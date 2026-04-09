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
  export PORT=4000
  
  echo "🛡 Configuring Firewall (UFW)..."
  sudo ufw allow OpenSSH || true
  sudo ufw allow 80/tcp || true
  sudo ufw allow 443/tcp || true
  sudo ufw --force enable

  echo "🌐 Configuring NGINX..."
  if ! command -v nginx &> /dev/null
  then
      echo "Installing Nginx..."
      sudo apt-get update && sudo apt-get install -y nginx
  fi

  # Create NGINX conf
  sudo bash -c "cat > /etc/nginx/sites-available/rv2class.conf" << NGINX_CONF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        
        # Socket.io specific headers
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGINX_CONF

  sudo ln -sf /etc/nginx/sites-available/rv2class.conf /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl restart nginx
  
  cd $REMOTE_DIR
  
  export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"
  
  echo "📦 Installing npm dependencies..."
  npm install

  echo "🗄 Updating Prisma..."
  npx prisma generate
  npx prisma db push --accept-data-loss

  echo "🔄 Restarting API via pm2..."
  if ! command -v pm2 &> /dev/null
  then
      echo "⚠️ PM2 not found, installing it globally..."
      npm install -g pm2
  fi
  
  pm2 restart rv2class-api || pm2 start npm --name "rv2class-api" -- run start
  pm2 save
  
  echo "✅ BACKEND SUCCESSFULLY DEPLOYED!"
EOF

echo "🎉 Done! API is live."
