#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="bitfinex-proxy"
CONTEXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found. Please install Docker first." >&2
  exit 1
fi

echo "Building ${IMAGE_NAME} image..."
docker build -t "${IMAGE_NAME}" "${CONTEXT_DIR}"

echo "Starting ${IMAGE_NAME} container on port 8080..."
docker run --rm -p 8080:8080 "${IMAGE_NAME}"
