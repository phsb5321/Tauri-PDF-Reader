{
  description = "Lectrice — Tauri 2 desktop PDF reader devshell (Linux)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    # Linux-only — the package list is the Tauri 2 GTK/webkitgtk desktop chain.
    # eachDefaultSystem would let `nix flake check --all-systems` evaluate this
    # on x86_64-darwin and fail (no webkitgtk_4_1 there).
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Tauri 2 Linux runtime + build deps. Mirrors the upstream
        # `apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
        # libxdo-dev libayatana-appindicator3-dev librsvg2-dev` recipe.
        tauriLinuxDeps = with pkgs; [
          # Build tools
          gnumake
          pkg-config
          clang
          llvmPackages.libclang.lib

          # System libs the Rust crates link against
          openssl.dev
          alsa-lib
          webkitgtk_4_1
          libsoup_3
          gtk3
          glib
          gobject-introspection
          gdk-pixbuf
          pango
          cairo
          harfbuzz
          at-spi2-atk
          atk
          librsvg
          libayatana-appindicator
          # E2E lanes (101): the lanes' former hand-maintained list had these
          # three — the flake is now the ONE source, so they live here.
          perl
          speechd
          xvfb
          # Packaged observers query their hermetic SQLite profile between
          # app phases; the executable is part of the lane, not a host tool.
          sqlite
          # Close-journey lane (113): drives a GENUINE WM_DELETE_WINDOW close
          # through the X server (xdotool windowquit — the graceful close-
          # confirmation message; windowclose would destroy the window without
          # any client close request) — a process kill would prove nothing
          # about CloseRequested.
          xdotool
          # Drag-session lane (177): one-purpose visible X11 drag source for
          # the real PDF fixture. Unlike a synthetic DOM/Tauri event, dragon
          # exercises the same OS file drag a user performs from a file manager.
          dragon-drop
          # Close-journey lane (125): windowquit's WM_DELETE_WINDOW only
          # reaches the app when a REAL window manager is running — without
          # one the client message never arrives (lane-9: zero CloseRequested
          # firings). openbox is started by run-close-journey.sh after Xvfb.
          openbox
        ];
      in
      rec {
        # tauri-driver — the WebDriver↔Tauri bridge the packaged e2e lanes
        # drive (wdio.conf.mjs spawns it on port 4444). nixpkgs does NOT ship
        # it, so it is built here from crates.io and PINNED:
        # version 2.0.6 = the version this repo's lane host (desktop) has
        # provisioned (crates.io registry install), i.e. the one every lane
        # rehearsal ran against. The crate sha256 + cargoHash make the build
        # reproducible; bump deliberately, never by default.
        tauri-driver = pkgs.rustPlatform.buildRustPackage {
          pname = "tauri-driver";
          version = "2.0.6";
          src = pkgs.fetchCrate {
            pname = "tauri-driver";
            version = "2.0.6";
            sha256 = "sha256-fTCkEs4NLBW0khaHL4jpVNkrbQg22YPsRMjfJNqnCWA=";
          };
          # Pinned dependency closure instead of a first-pass hash: the
          # lockfile documents the exact versions the gate runs against.
          # cargoHash below is the SRI hash of the vendored closure the
          # cargo 1.97 in the flake's nixpkgs (rev 624af66) resolves for
          # tauri-driver 2.0.6 against the CURRENT crates.io index — the
          # cargoLock.lockFile form broke when the vendored resolution
          # diverged from the crate tarball's shipped v3 lockfile (the
          # tarball locks 95 dev-inclusive packages at windows-sys 0.52;
          # cargo 1.97 vendors 68 packages at windows-sys 0.61), which no
          # lockfile content could reconcile: the vendor pass re-resolves
          # and the consistency check compares against the tarball's lock.
          # Regenerate by `nix hash path --type sha256 $(nix build
          # '.#devShells.x86_64-linux.default' --no-link ...)` after any
          # deliberate bump; bump deliberately, never by default.
          cargoHash = "sha256-MThAcU+U8PyBGauh3dy7ZRvRX9INmOEeghIlQEGLAPs=";
          doCheck = false;
        };

        devShells.default = pkgs.mkShell {
          # pnpm is pinned to nixpkgs' pnpm_10: the project's lockfile is
          # pnpm 10 format, and a host pnpm 11 on PATH (Pedro's ~/.local/bin
          # was upgraded 13/08/2026) triggers pnpm's deps-status purge of the
          # symlinked node_modules every time a lane runs a script inside the
          # devShell (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR). The shell must
          # never fall back to the host's pnpm — the nix package is the pin.
          # rustc + cargo + tauri-driver pin the toolchain to the flake's
          # nixpkgs rev — lanes build with the SAME pinned rust the
          # tauri-driver package uses, never an unpinned host toolchain.
          packages = [
            pkgs.nodejs_22
            pkgs.pnpm_10
            tauri-driver
            pkgs.rustc
            pkgs.cargo
            pkgs.rustfmt
            pkgs.clippy
          ] ++ tauriLinuxDeps;

          # bindgen (used transitively by several -sys crates) needs libclang.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";

          # GTK's compiled schemas live under Nix's share/gsettings-schemas
          # roots, not the ordinary package share roots setup.sh adds to
          # XDG_DATA_DIRS. Without this bridge, opening the native file chooser
          # aborts the whole app with "No GSettings schemas are installed".
          shellHook = ''
            export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH''${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
          '';

          # Headless GL on a NON-NixOS lane host (143). The nix-built WebKit
          # resolves GL through libglvnd, which looks for drivers in
          # /run/opengl-driver — a NixOS-only path that does not exist on the
          # Ubuntu CI runner, and the host's own /usr/share/glvnd vendor JSON
          # points at host drivers the nix libEGL will not load. WebKit then
          # aborts at launch ("Could not create default EGL display:
          # EGL_BAD_PARAMETER. Aborting...") and every packaged-lane session
          # dies mid-spec with "invalid session id" — observed 18/08/2026 on
          # the pr-fast lane, run 32172435260. These are libglvnd's and mesa's
          # own documented lookup overrides, pointing at the flake's pinned
          # mesa (swrast/llvmpipe), so the lanes get software GL from the same
          # rev as the rest of the toolchain. LIBGL_ALWAYS_SOFTWARE (exported
          # by the lane runners) selects that driver; it cannot help while the
          # loader finds no driver directory at all.
          LIBGL_DRIVERS_PATH = "${pkgs.mesa}/lib/dri";
          __EGL_VENDOR_LIBRARY_FILENAMES = "${pkgs.mesa}/share/glvnd/egl_vendor.d/50_mesa.json";
        };

        packages.tauri-driver = tauri-driver;
      });
}
