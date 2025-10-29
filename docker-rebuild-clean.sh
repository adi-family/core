#!/bin/bash
# Clean rebuild script for Docker production images
# This script forces a complete rebuild without using cached layers

echo "🧹 Cleaning Docker build cache..."
docker builder prune -af

echo "🐳 Building production images without cache..."
docker-compose -f docker-compose.prod.yaml build --no-cache --pull

echo "✅ Clean build complete!"
