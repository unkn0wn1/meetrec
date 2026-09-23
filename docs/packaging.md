# Packaging

Installable builds use **electron-builder**. electron-vite still compiles to `out/`. The builder reads `out/` and writes installers to `dist/` (gitignored). The package stays `private: true`. `appId` is `io.techglint.meetrec`.

Nothing here is signed, published, or auto-updated.

## Build

```bash
npm install
npm run dist:linux
npm run dist:win
```

| Script         | What it produces                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dist` | Current OS. On Linux that is the AppImage. On Windows that is NSIS and portable.                                                 |
| `dist:linux`   | `dist/meetrec-<version>.AppImage`                                                                                                |
| `dist:win`     | `dist/meetrec-<version>-setup.exe` (NSIS, per-user, choose a directory) and `dist/meetrec-<version>-portable.exe`. Both are x64. |

Each script runs `npm run build` first (typecheck, then electron-vite).

`package.json` sets `desktopName` to `meetrec.desktop`, and the Linux target sets `syncDesktopName`. That keeps the desktop file name and the window class the same, so a desktop environment can match the running app.

`dist:win` is the Windows contract. Run it on Windows or on `windows-latest`. A Linux machine needs Wine before NSIS can finish; a Wine miss on a Linux host does not mean the config is wrong.

If AppImage fails with a FUSE error (`fuse: device not found`, or a mount error), rerun:

```bash
APPIMAGE_EXTRACT_AND_RUN=1 npm run dist:linux
```

## ffmpeg

Windows and Linux builds still spawn `ffmpeg` from `PATH`. The installer does not ship a binary. Capture already errors when it is missing.

A later change can put ffmpeg under `extraResources` and point that spawn at `process.resourcesPath`.

## Icons

No app icon is checked in. electron-builder uses the default Electron icon. Replace it later with:

- `build/icon.png` — Linux, at least 512×512
- `build/icon.ico` — Windows

## Unsigned Windows builds

SmartScreen shows “Windows protected your PC” for an unsigned exe. More info → Run anyway is the private-use path.

Authenticode is not set up. Signing can be added later without code changes by providing a certificate in the environment: `CSC_LINK` (path or URL to a `.pfx`) and `CSC_KEY_PASSWORD`. `WIN_CSC_LINK` is the Windows-specific alias. Do not commit the certificate or the password.

## Linux sandbox

The packaged app has the same `chrome-sandbox` requirement as development. See the root README: either `chown`/`chmod 4755` on the sandbox helper, or the local `--no-sandbox` workaround.

## Auto-update

Auto-update is not included. A follow-up can add `electron-updater` and a publish URL after a real release exists. Windows updates should wait until Authenticode is in place, or SmartScreen will block the downloaded installer the same way.

## GitHub Actions

**CI** (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main`: typecheck, lint, format, file-size guard, tests. See [quality-gates.md](quality-gates.md). Merging to `main` does **not** publish installers.

**Releases** (`.github/workflows/release.yml`) run only when you push a `v*` tag. GitHub-hosted runners build Linux (`ubuntu-latest` → AppImage) and Windows (`windows-latest` → NSIS + portable exe), then attach those files to a GitHub Release. Tags with a hyphen (`v0.1.0-alpha.1`, `v0.2.0-beta.1`, `v1.0.0-rc.1`) are marked **prerelease**. Plain tags like `v1.0.0` are a full release.

Cut an alpha after the version bump is on `main`:

```bash
# package.json "version" should already match, e.g. 0.1.0-alpha.1
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

**Ad-hoc package** (`.github/workflows/package.yml`) is **workflow_dispatch** only: same builders, upload artifacts, no GitHub Release. Use it to smoke-test packaging without tagging.

## Local installer smoke

`APPIMAGE_EXTRACT_AND_RUN=1 npm run dist:linux` is the Linux smoke when FUSE is missing. The builder uses the default Electron icon until `build/icon.png` exists. Run `dist:win` on Windows (or `windows-latest`).
