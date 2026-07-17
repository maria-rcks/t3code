# AUR packaging

Packaging for the Arch Linux (AUR) distribution of the T3 Code desktop app:

- [`t3code-bin`](https://aur.archlinux.org/packages/t3code-bin) — stable releases
- [`t3code-nightly-bin`](https://aur.archlinux.org/packages/t3code-nightly-bin) — nightly prereleases

Both packages repackage the official x86_64 AppImage published on GitHub Releases. Icons and the
desktop launcher are taken from the AppImage payload itself, so each channel ships its own branding
(stable vs nightly icon) automatically.

## How publishing works

`.github/workflows/publish-aur.yml` runs when a GitHub release is published:

1. Resolves the release matching each package's channel (stable tags `vX.Y.Z`, nightly tags
   `vX.Y.Z-nightly.*`) and reads the AppImage asset's sha256 digest from the release metadata.
2. Patches the package's `PKGBUILD` (`pkgver`, `pkgrel`, `_upstream_tag`, `sha256sums`) via
   `scripts/update_pkgbuild.sh`.
3. Regenerates `.SRCINFO` and test-builds the package with `makepkg` in an `archlinux:base-devel`
   container.
4. Pushes `PKGBUILD`, `.SRCINFO`, and `LICENSE` to the AUR over SSH (`scripts/publish_aur.sh`).

The workflow can also be run manually (`workflow_dispatch`) to republish, with an optional `pkgrel`
override for republishing the same upstream version.

The `PKGBUILD` files in this directory are templates: CI patches the version fields at publish
time, so the committed `pkgver`/`sha256sums` values are only a snapshot of the last edit.

## Required configuration

| Kind                | Name                                   | Purpose                                                                                                                                           |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret              | `AUR_SSH_PRIVATE_KEY`                  | SSH private key authorized on the AUR account that maintains both packages. Publishing is skipped (dry run) when unset, so forks only test-build. |
| Variable (optional) | `AUR_COMMIT_NAME` / `AUR_COMMIT_EMAIL` | Committer identity used for AUR pushes.                                                                                                           |
| Variable (optional) | `UPSTREAM_REPO`                        | Overrides the release source repo (defaults to this repository).                                                                                  |

## Testing locally

On an Arch system (or `archlinux:base-devel` container):

```bash
cd packaging/aur/t3code-bin
cp ../../../LICENSE .
makepkg --printsrcinfo > .SRCINFO
makepkg -f --nodeps --noconfirm
```
