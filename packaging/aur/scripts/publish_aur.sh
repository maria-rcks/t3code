#!/usr/bin/env bash
# Pushes the package payload (PKGBUILD, .SRCINFO, LICENSE) to the AUR.
# Run from the package directory after makepkg has regenerated .SRCINFO.
set -euo pipefail

AUR_GIT_URL="${AUR_GIT_URL:-ssh://aur@aur.archlinux.org/t3code-bin.git}"
AUR_BRANCH="${AUR_BRANCH:-master}"
AUR_COMMIT_NAME="${AUR_COMMIT_NAME:-t3code-ci}"
AUR_COMMIT_EMAIL="${AUR_COMMIT_EMAIL:-t3code-ci@users.noreply.github.com}"
AUR_PAYLOAD_FILES="${AUR_PAYLOAD_FILES:-PKGBUILD .SRCINFO LICENSE}"
DRY_RUN="${DRY_RUN:-false}"

retry() {
  local attempt max_attempts delay
  max_attempts=3
  delay=5

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if "$@"; then
      return 0
    fi

    if ((attempt == max_attempts)); then
      return 1
    fi

    echo "Command failed; retrying in ${delay}s (${attempt}/${max_attempts})..." >&2
    sleep "$delay"
    delay=$((delay * 2))
  done
}

if [[ "$DRY_RUN" != "true" && -z "${AUR_SSH_PRIVATE_KEY:-}" ]]; then
  echo "AUR_SSH_PRIVATE_KEY is required" >&2
  exit 1
fi

rm -rf /tmp/aur-payload
mkdir -p /tmp/aur-payload

for file in $AUR_PAYLOAD_FILES; do
  if [[ ! -f "$file" ]]; then
    echo "Missing payload file: $file" >&2
    exit 1
  fi
  cp -f "$file" /tmp/aur-payload/
done

printf '%s\n' "${GITHUB_SHA:-local}" > /tmp/aur-payload/.upstream-commit

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY_RUN=true, skipping AUR git push."
  echo "Prepared payload in /tmp/aur-payload"
  exit 0
fi

printf '%s\n' "$AUR_SSH_PRIVATE_KEY" > /tmp/aur_id_ed25519
chmod 600 /tmp/aur_id_ed25519

ssh-keyscan -H -t ed25519,rsa aur.archlinux.org > /tmp/aur_known_hosts 2>/dev/null
chmod 644 /tmp/aur_known_hosts

export GIT_SSH_COMMAND="ssh -i /tmp/aur_id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=/tmp/aur_known_hosts -o StrictHostKeyChecking=yes"

rm -rf /tmp/aur-repo
retry git clone "$AUR_GIT_URL" /tmp/aur-repo

git config --global --add safe.directory /tmp/aur-repo
rsync -a --delete --exclude='.git/' /tmp/aur-payload/ /tmp/aur-repo/

cd /tmp/aur-repo
git checkout -B "$AUR_BRANCH"
git config user.name "$AUR_COMMIT_NAME"
git config user.email "$AUR_COMMIT_EMAIL"

git add -A
if git diff --cached --quiet; then
  echo "No staged changes to publish."
  exit 0
fi

git commit -m "chore(aur): sync from ${GITHUB_REPOSITORY:-local}@${GITHUB_SHA:-local}"
retry git push origin "$AUR_BRANCH"
