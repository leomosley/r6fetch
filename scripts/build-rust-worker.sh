#!/bin/sh
set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

cargo install --quiet worker-build --version 0.8.5
worker-build --release --no-panic-recovery "$SCRIPT_DIR/../apps/api"
