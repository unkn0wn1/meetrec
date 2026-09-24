# Packaging

Installable builds use **electron-builder**. electron-vite still compiles to `out/`. The builder reads `out/` and writes installers to `dist/` (gitignored). The package stays `private: true`. `appId` is `io.techglint.meetrec`.

Tag releases sign Windows installers with Azure Trusted Signing. The Linux AppImage stays unsigned. Ad-hoc and local Windows builds stay unsigned. NSIS and AppImage check GitHub Releases for updates. Portable is manual.

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

`npm run dist`, `dist:linux`, and `dist:win` run `npm run fetch:ffmpeg` before electron-builder. The script downloads a pinned [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) **LGPL static** build into `vendor/ffmpeg/` (gitignored). electron-builder copies that directory to `resources/ffmpeg/`.

| Target      | Vendor path                        | Packaged path                 |
| ----------- | ---------------------------------- | ----------------------------- |
| Linux x64   | `vendor/ffmpeg/linux-x64/ffmpeg`   | `resources/ffmpeg/ffmpeg`     |
| Windows x64 | `vendor/ffmpeg/win-x64/ffmpeg.exe` | `resources/ffmpeg/ffmpeg.exe` |

`LICENSE.txt` sits next to the binary. That file is FFmpeg's `COPYING.LGPLv3` (GNU LGPLv3, `--enable-version3`). `SOURCE.txt` names the BtbN tag, the archive URL, and the SHA-256. meetrec starts ffmpeg as a separate program. The LGPL variant leaves out GPL-only libraries such as libx264 and libx265.

The pin is FFmpeg **n9.0.2-3-ga5923073bf**, tag `autobuild-2026-09-22-13-18`. The Linux archive is about 131 MiB compressed and the Windows zip is about 163 MiB compressed. Unpacked `ffmpeg` is 135 MiB and unpacked `ffmpeg.exe` is 127 MiB. That is what the AppImage and the Windows installer carry before squashfs or NSIS compression. With this pin, `dist:linux` writes an AppImage of about 173 MiB. BtbN's Linux build needs glibc 2.28 or newer. The Windows build targets Windows 10 22H2 or newer.

At runtime, capture uses `process.resourcesPath/ffmpeg/ffmpeg` (or `ffmpeg.exe`) when that file exists. `npm run dev` does not ship that file, so it uses `ffmpeg` on `PATH`. If both are missing, recording throws a clear error.

`npm run build` does not download ffmpeg. CI unit tests stay offline. Fetch is idempotent and checks SHA-256 before extract. On Linux it also checks that the binary lists a `pulse` demuxer.

```bash
npm run fetch:ffmpeg -- --platform linux
npm run fetch:ffmpeg -- --platform win
npm run fetch:ffmpeg -- --platform all
```

A bare `npm run fetch:ffmpeg` downloads the host platform (`linux` or `win`).

## Icons

App icons are checked in under `build/`, derived from the marketing header mark (mic on cyan→violet rounded square; same language as `meetrec-web` `AppHeader` / `public/favicon.svg`).

| File                                     | Use                                                               |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `build/icon.png`                         | Linux packaging and window chrome (≥512×512; currently 1024×1024) |
| `build/icon.ico`                         | Windows packaging (multi-size 16–256)                             |
| `build/tray-icon.png`                    | Tray (32×32 filled mic on gradient; resized to 16×16 at runtime)  |
| `build/icon.svg` / `build/tray-icon.svg` | Sources for regenerating the rasters                              |

electron-builder picks up `build/icon.png` / `build/icon.ico` from the default `build/` resources directory. Runtime tray and `BrowserWindow` icons load from `resources/icons/` in packaged builds (`extraResources`) and from `build/` in `npm run dev`.

## Windows signing

Tag releases sign the Windows NSIS installer and the portable exe with Azure Trusted Signing. electron-builder 26 reads `win.azureSignOptions` (not `win.sign.type`).

| Key                      | Value                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `publisherName`          | `CN=TechGlint, O=TechGlint, L=London, S=Greater London, C=GB` |
| `endpoint`               | `https://eus.codesigning.azure.net/`                          |
| `certificateProfileName` | `meetrec-public`                                              |
| `codeSigningAccountName` | `techglint`                                                   |

Auth is Azure Identity `EnvironmentCredential`: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`. The tag workflow's Windows job passes those from existing GitHub Actions secrets. Do not commit the secret values.

`.github/workflows/package.yml` and a normal local `dist:win` do not set those variables. The ad-hoc Windows job also passes `--config.win.signAndEditExecutable=false`, so those artifacts stay unsigned. A machine that already has the three variables exported will attempt to sign on a local `dist:win`.

A Trusted Signing signature is not SmartScreen publisher reputation. “Windows protected your PC” can still appear until that reputation builds. More info → Run anyway remains the path while reputation is low.

The Linux AppImage stays unsigned.

## Linux sandbox

The packaged app has the same `chrome-sandbox` requirement as development. See the root README: either `chown`/`chmod 4755` on the sandbox helper, or the local `--no-sandbox` workaround.

## Auto-update

Packaged Linux AppImage and Windows NSIS check the public GitHub Releases for `unkn0wn1/meetrec` on launch and from Settings → General. electron-updater reads `latest-linux.yml` or `latest.yml`. A prerelease `package.json` version reads the `beta`, `rc`, or `alpha` channel file instead (`0.2.0-beta.1` → `beta.yml` and `beta-linux.yml`). The yml `path` is `meetrec-<version>.AppImage` or `meetrec-<version>-setup.exe`.

The tag workflow uploads those yml files and `*.blockmap` next to the installers. `npm run dist`, `dist:linux`, and `dist:win` keep `--publish never`, so electron-builder writes the metadata and does not upload it. softprops uploads the files. No token is stored in the app or the repo. The repository is public.

Windows auto-update installs the signed NSIS setup. `publisherName` in the publish config is the TechGlint subject (`CN=TechGlint, O=TechGlint, L=London, S=Greater London, C=GB`). Signature verification stays on. Portable users download the new `meetrec-<version>-portable.exe`. The portable build says that and does not call GitHub.

`npm run dev` (`app.isPackaged === false`) does not check GitHub. Settings says updates apply to packaged installs.

A downloaded update does not quit the app during a recording. Restart and install is explicit, and only while recording is idle.

SmartScreen reputation is still separate from the signature. The updater does not change “Windows protected your PC”.

The first real feed check is the next `v*` tag after this ships. CI does not perform that round-trip.

## GitHub Actions

**CI** (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main`: typecheck, lint, format, file-size guard, tests. See [quality-gates.md](quality-gates.md). Merging to `main` does **not** publish installers.

**Releases** (`.github/workflows/release.yml`) run only when you push a `v*` tag. GitHub-hosted runners build Linux (`ubuntu-latest` → AppImage) and Windows (`windows-latest` → NSIS + portable exe), then attach those installers, the channel yml files, and blockmaps to a GitHub Release. `--publish never` stays on the dist scripts, so electron-builder writes the metadata and softprops is the only uploader. The Windows job signs with Azure Trusted Signing when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` are set. The Linux AppImage stays unsigned. Tags with a hyphen (`v0.1.0-alpha.1`, `v0.2.0-beta.1`, `v1.0.0-rc.1`) are marked **prerelease**. Plain tags like `v1.0.0` are a full release. A prerelease tag uploads `beta` / `rc` / `alpha` yml files instead of `latest`.

Cut a release after the version bump is on `main`:

```bash
# package.json "version" should already match, e.g. 0.1.0
git tag v0.1.0
git push origin v0.1.0
```

For a prerelease, use a hyphenated tag that matches `package.json` (e.g. `v0.1.0-alpha.3`).

**Ad-hoc package** (`.github/workflows/package.yml`) is **workflow_dispatch** only: same builders, upload artifacts, no GitHub Release. It does not receive the Azure secrets. The Windows job passes `--config.win.signAndEditExecutable=false`, so those artifacts stay unsigned. It uploads installers only. Those artifacts are not the update feed. Use it to smoke-test packaging without tagging.

## Local installer smoke

`APPIMAGE_EXTRACT_AND_RUN=1 npm run dist:linux` is the Linux smoke when FUSE is missing. Installers and the tray use `build/icon.*` / `build/tray-icon.png`. Run `dist:win` on Windows (or `windows-latest`).
