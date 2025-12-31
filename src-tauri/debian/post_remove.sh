#!/bin/sh
set -e

APP_NAME="cadet"
APP_DATA_DIR="/var/lib/${APP_NAME}"

log() {
    echo "[cadet] $1"
}

case "$1" in
purge)
    log "Removing cadet data directory..."
    if [ -d "$APP_DATA_DIR" ]; then
        log "Deleting $APP_DATA_DIR"
        rm -rf "$APP_DATA_DIR"
        log "cadet data removed successfully"
    else
        log "No data directory found at $APP_DATA_DIR"
    fi
    ;;
esac

exit 0
