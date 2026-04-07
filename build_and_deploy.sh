#!/bin/bash
set -e
echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building..."
pnpm run build

echo "📦 Syncing core files to Decky directory..."
sudo mkdir -p ~/homebrew/plugins/pocket-protector

# Use rsync for precise synchronization, excluding unnecessary source files and large dependencies
sudo rsync -a --delete --exclude='node_modules' --exclude='.git' --exclude='src' --exclude='*.sh' . ~/homebrew/plugins/pocket-protector/

echo "🔄 Restarting Decky service..."
sudo systemctl restart plugin_loader.service

echo "✅ Deployment complete!"