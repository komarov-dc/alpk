#!/bin/bash
# Setup PM2 log rotation
# Run this script once after installing PM2

# Install pm2-logrotate module
pm2 install pm2-logrotate

# Configure log rotation settings
pm2 set pm2-logrotate:max_size 100M      # Max file size before rotation
pm2 set pm2-logrotate:retain 10          # Keep 10 rotated files
pm2 set pm2-logrotate:compress true      # Compress rotated files
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss  # Date format for rotated files
pm2 set pm2-logrotate:rotateModule true  # Also rotate PM2 module logs
pm2 set pm2-logrotate:workerInterval 30  # Check interval in seconds

echo "PM2 log rotation configured successfully!"
echo "Settings:"
pm2 get pm2-logrotate
