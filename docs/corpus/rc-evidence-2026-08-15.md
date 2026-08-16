# `v0.2.0-rc.0` dry-run and platform receipts — 15/08/2026

Verbatim receipts for the two release-checklist boxes that are stamped at a
single SHA rather than re-run per head. Everything below was produced against
tag `v0.2.0-rc.0`, which targets commit
`3d68d0e052817cf7633b9e6b7d085e9432652951`.

No private document bytes, titles, hashes, or paths appear here.

## 1. Release pipeline

Workflow run `31911698292` (`.github/workflows/release.yml`, self-hosted vm103)
completed successfully and published the prerelease `Lectrice v0.2.0-rc.0`.

```
tag        v0.2.0-rc.0
prerelease true
target     3d68d0e052817cf7633b9e6b7d085e9432652951
published  2026-08-15T22:45:16Z
assets     Lectrice_0.2.0_amd64.AppImage   83286520 B
           Lectrice_0.2.0_amd64.deb         9231910 B
```

Downloaded asset digests:

```
4e95a615e943479562e22fbfd1fc76b528942ff34124d0a26ad4d62f17318090  Lectrice_0.2.0_amd64.AppImage
340c604bf057d928b2c026eb217cafef203fa4839b3f7d392e752056d9e4ed65  Lectrice_0.2.0_amd64.deb
```

## 2. Both artifacts on the platform they target

Verified in a clean `docker.io/library/ubuntu:24.04` container, not on the
NixOS build host. The window check is ownership-based: a window only counts if
its `WM_CLASS` is the app's, because the container already has one unrelated
window (`windows_before=1`) and a looser match would have accepted it.

`.deb` — install, then launch under Xvfb:

```
Version: 0.2.0
windows_before=1
OWNED_WINDOW=2097155 pid=5867 app_pid=5867
WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
Window 2097155
  Position: 0,0 (screen: 0)
  Geometry: 1200x800
DEB_STRICT_PASS
```

AppImage — same container, `APPIMAGE_EXTRACT_AND_RUN=1` (no FUSE). Here the
window's PID cannot equal the launcher's, because extract-and-run execs the
real binary as a child, so ownership is asserted by walking the window PID's
parent chain back to the launcher this check started:

```
windows_before=1
LAUNCHER_PID=5855
OWNED_WINDOW=2097155 window_pid=5869 launcher_pid=5855
--- ancestry
    PID    PPID COMMAND
   5869    5855 tauri-pdf-reade
    PID    PPID COMMAND
   5855    5847 lectrice.AppIma
WM_CLASS(STRING) = "tauri-pdf-reader", "Tauri-pdf-reader"
Window 2097155
  Position: 0,0 (screen: 0)
  Geometry: 1200x800
APPIMAGE_OWNERSHIP_PASS
```

1200x800 is the window size `src-tauri/tauri.conf.json` asks for, so the
geometry is a second, independent signal that the window is the app's.

### The AppImage does not launch on a NixOS host under Xvfb

```
INFO tauri_pdf_reader_lib::hw_accel: Linux detected - GPU compositing enabled (DMABUF renderer disabled)
INFO tauri_pdf_reader_lib: PDF Reader starting...
Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
```

The app enables GPU compositing on Linux and Xvfb offers no EGL display. This
is an environment mismatch on the build host, not a defect in the published
artifact — the same binary runs in the container above. (Extracting the
AppImage and running it directly on NixOS also fails earlier, at
`libfribidi.so.0`, because an AppImage expects an FHS host.)

## 3. macOS: builds and launches, journey blocked

macOS 26.6.1, arm64, worktree at `3d68d0e`. macOS is **not** a published
artifact; this section exists so the platform's state is measured rather than
assumed.

Build succeeds only with the Command Line Tools SDK on the link path — the
plain `pnpm tauri build` fails:

```
error: linking with `cc` failed: exit status: 1
  = note: ld: library not found for -liconv
```

With `SDKROOT=$(xcrun --show-sdk-path)` and `LIBRARY_PATH=$SDKROOT/usr/lib`:

```
Finished 1 bundle at:
    …/src-tauri/target/release/bundle/macos/Lectrice.app
EXIT=0
```

Bundle and launch:

```
CFBundleShortVersionString  0.2.0
CFBundleIdentifier          com.lectrice.reader
Contents/MacOS/tauri-pdf-reader
  sha256 91dbfc93481354c7217c8b9370f19d65795ff45b8857a4c29c705a3a8b0a21d8
codesign  adhoc, linker-signed, Mach-O thin (arm64)

instances  1   pid 90170
Quartz     {'owner': 'Lectrice', 'pid': 90170, 'bounds': {'X': 168.0, 'Y': 79.0, 'Width': 1176.0, 'Height': 784.0}}
```

Why no open/render/restart receipt follows — three independent blockers:

```
# 1. the window exposes no accessibility children
$ osascript -e 'tell application "System Events" to tell process "tauri-pdf-reader" to get count of windows'
0
$ … get name of every menu bar item of menu bar 1
Apple, Lectrice, View, Playback, Help          # only the menu bar is exposed

# 2. no file association and no CLI open path
$ jq '.bundle | keys' src-tauri/tauri.conf.json
["active","icon","targets"]                     # no fileAssociations; no RunEvent::Opened handler

# 3. tauri-driver has no macOS support
```

The menu bar alone cannot open a document: `Open PDF…` raises the system open
panel, and filling that panel needs synthetic keystrokes aimed at whatever is
frontmost on a live desktop. That is not a controlled oracle and not a safe
action, so the journey is recorded **BLOCKED** rather than attempted-green.
`docs/KNOWN_LIMITATIONS.md` carries the same three reasons as the conditions
that would have to change.
