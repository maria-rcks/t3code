#!/usr/bin/env bash
# Resolves the upstream release + AppImage asset a package should publish.
#
# When RELEASE_TAG is set (release-event runs) the script inspects that exact
# release and reports matched=false when the tag does not belong to this
# package's channel. Otherwise it resolves the newest matching release.
set -euo pipefail

UPSTREAM_REPO="${UPSTREAM_REPO:-${GITHUB_REPOSITORY:-pingdotgg/t3code}}"
RELEASE_TAG="${RELEASE_TAG:-}"
RELEASE_TAG_REGEX="${RELEASE_TAG_REGEX:-^v}"
RELEASE_PRERELEASE="${RELEASE_PRERELEASE:-false}"
RELEASE_VERSION_PREFIX="${RELEASE_VERSION_PREFIX:-v}"
ASSET_REGEX="${ASSET_REGEX:-^T3-Code-.*-x86_64\.AppImage$}"
out_file="${GITHUB_OUTPUT:-}"

emit() {
  printf '%s=%s\n' "$1" "$2"
  if [[ -n "$out_file" ]]; then
    printf '%s=%s\n' "$1" "$2" >> "$out_file"
  fi
}

if [[ -n "$RELEASE_TAG" ]]; then
  release_json="$(gh api "repos/$UPSTREAM_REPO/releases/tags/$RELEASE_TAG")"
  release_json="$(jq -c \
    --arg regex "$RELEASE_TAG_REGEX" \
    --arg prerelease "$RELEASE_PRERELEASE" '
      select(
        (.draft | not)
        and (.prerelease == ($prerelease == "true"))
        and (.tag_name | test($regex))
      ) // empty
    ' <<<"$release_json")"
else
  releases_json="$(gh api "repos/$UPSTREAM_REPO/releases?per_page=100")"
  release_json="$(jq -c \
    --arg regex "$RELEASE_TAG_REGEX" \
    --arg prerelease "$RELEASE_PRERELEASE" '
      map(
        select(
          (.draft | not)
          and (.prerelease == ($prerelease == "true"))
          and (.tag_name | test($regex))
        )
      )
      | first // empty
    ' <<<"$releases_json")"
fi

if [[ -z "$release_json" ]]; then
  echo "No release matching this package's channel (tag='${RELEASE_TAG:-latest}')."
  emit matched false
  exit 0
fi

upstream_tag="$(jq -r '.tag_name // empty' <<<"$release_json")"
if [[ -z "$upstream_tag" ]]; then
  echo "Failed to resolve matching upstream tag from $UPSTREAM_REPO" >&2
  exit 1
fi

asset_json="$(jq -c --arg regex "$ASSET_REGEX" '
  .assets
  | map(select(.name | test($regex)))
  | first // empty
' <<<"$release_json")"

if [[ -z "$asset_json" || "$asset_json" == "null" ]]; then
  echo "Failed to find x86_64 AppImage asset in release $upstream_tag for $UPSTREAM_REPO" >&2
  exit 1
fi

appimage_name="$(jq -r '.name // empty' <<<"$asset_json")"
appimage_url="$(jq -r '.browser_download_url // empty' <<<"$asset_json")"
appimage_sha256="$(jq -r '.digest // empty' <<<"$asset_json")"
appimage_sha256="${appimage_sha256#sha256:}"

if [[ -z "$appimage_name" || -z "$appimage_url" ]]; then
  echo "Incomplete AppImage asset metadata returned by GitHub." >&2
  exit 1
fi

if [[ -z "$appimage_sha256" ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  curl -fL --retry 3 --retry-delay 2 "$appimage_url" -o "$tmp_dir/$appimage_name"
  appimage_sha256="$(sha256sum "$tmp_dir/$appimage_name" | awk '{print $1}')"
fi

upstream_version="${upstream_tag#"$RELEASE_VERSION_PREFIX"}"
pkgver_candidate="$(printf '%s' "$upstream_version" | tr '-' '_' | tr -cd '[:alnum:]_.+')"

emit matched true
emit upstream_tag "$upstream_tag"
emit upstream_version "$upstream_version"
emit pkgver_candidate "$pkgver_candidate"
emit appimage_name "$appimage_name"
emit appimage_url "$appimage_url"
emit appimage_sha256 "$appimage_sha256"
