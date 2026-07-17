#!/usr/bin/env bash
# Copies repo-level assets shared by every AUR package into a package dir so
# makepkg can resolve its local sources.
set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(pwd)}"
PACKAGE_DIR="${PACKAGE_DIR:-.}"
SHARED_FILES="${SHARED_FILES:-LICENSE}"

package_dir_abs="$(cd "$PACKAGE_DIR" && pwd)"
workspace_root_abs="$(cd "$WORKSPACE_ROOT" && pwd)"

for file in $SHARED_FILES; do
  src_path="$workspace_root_abs/$file"
  dest_path="$package_dir_abs/$(basename "$file")"

  if [[ ! -f "$src_path" ]]; then
    echo "Missing shared asset: $src_path" >&2
    exit 1
  fi

  if [[ "$src_path" == "$dest_path" ]]; then
    continue
  fi

  cp -f "$src_path" "$dest_path"
done
