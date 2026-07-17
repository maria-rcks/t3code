# AUR packaging

Packaging for the Arch Linux (AUR) distribution of the T3 Code desktop app:

- [`t3code-bin`](https://aur.archlinux.org/packages/t3code-bin) — stable releases
- [`t3code-nightly-bin`](https://aur.archlinux.org/packages/t3code-nightly-bin) — nightly prereleases

Both packages repackage the official x86_64 AppImage published on GitHub Releases. Icons are taken
from the AppImage payload itself, so each channel ships its own branding (stable vs nightly icon)
automatically.

## How publishing works

`.github/workflows/publish-aur.yml` runs `scripts/release.sh <package-dir>` for both packages
whenever a GitHub release is published. The script:

1. Resolves the release matching the package's channel (stable tags `vX.Y.Z`, nightly tags
   `vX.Y.Z-nightly.*`) and reads the AppImage sha256 from the release asset digest. A release for
   the other channel is a no-op.
2. Patches the `PKGBUILD` (`pkgver`, `pkgrel`, `_upstream_tag`, `sha256sums`), regenerates
   `.SRCINFO`, and test-builds the package with `makepkg`.
3. Pushes `PKGBUILD`, `.SRCINFO`, and `LICENSE` to the AUR over SSH — skipped as a dry run when
   `AUR_SSH_PRIVATE_KEY` is not configured (for example on forks).

The workflow can also be run manually (`workflow_dispatch`) with an optional release tag and a
`pkgrel` override for republishing the same upstream version.

The committed `PKGBUILD` files are templates: CI patches the version fields at publish time, so the
committed `pkgver`/`sha256sums` values are only a snapshot of the last edit.

## Required configuration

| Kind                | Name                                   | Purpose                                                                     |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Secret              | `AUR_SSH_PRIVATE_KEY`                  | SSH private key authorized on the AUR account that maintains both packages. |
| Variable (optional) | `AUR_COMMIT_NAME` / `AUR_COMMIT_EMAIL` | Committer identity for AUR pushes (defaults to `t3code-ci`).                |
| Variable (optional) | `UPSTREAM_REPO`                        | Overrides the release source repo (defaults to this repository).            |

## Testing locally

On an Arch system (or `archlinux:base-devel` container) with `gh`, `jq`, and `curl`:

```bash
GH_TOKEN=$(gh auth token) GITHUB_REPOSITORY=pingdotgg/t3code \
  packaging/aur/scripts/release.sh packaging/aur/t3code-bin
```

Without `AUR_SSH_PRIVATE_KEY` this resolves the latest stable release, builds the package, and
stops before pushing anything.
