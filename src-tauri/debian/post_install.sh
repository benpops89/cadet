#!/bin/sh
set -e

APP_NAME="cadet"
APP_DATA_DIR="/var/lib/${APP_NAME}"
VENV_DIR="${APP_DATA_DIR}/.venv"
PYTHON_BIN="/usr/bin/python3"
CADQUERY_VERSION="2.6.1"

case "$1" in
configure)
  echo "[postinst] Creating app data directory: $APP_DATA_DIR"
  mkdir -p "$APP_DATA_DIR"
  chown -R root:root "$APP_DATA_DIR"
  chmod 755 "$APP_DATA_DIR"

  if [ ! -d "$VENV_DIR" ]; then
    echo "[postinst] Creating Python virtual environment at $VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  else
    echo "[postinst] Virtual environment already exists at $VENV_DIR"
  fi

  echo "[postinst] Upgrading pip, setuptools, wheel"
  "$VENV_DIR/bin/python" -m pip install --upgrade pip setuptools wheel

  echo "[postinst] Installing cadquery==$CADQUERY_VERSION"
  "$VENV_DIR/bin/pip" install --no-cache-dir "cadquery==$CADQUERY_VERSION"

  echo "[postinst] Post-install finished successfully"
  ;;
esac

exit 0
