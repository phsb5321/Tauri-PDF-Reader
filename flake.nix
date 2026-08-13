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
          # Close-journey lane (113): drives a GENUINE WM_DELETE_WINDOW close
          # through the X server (xdotool windowclose) — a process kill would
          # prove nothing about CloseRequested.
          xdotool
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
          # Pinned dependency closure (68 packages) instead of an opaque
          # cargoHash — the lockfile documents the exact versions the gate
          # runs against and makes the build reproducible without a
          # first-pass hash computation.
          cargoLock = {
            lockFile = ./tauri-driver-Cargo.lock;
          };
          doCheck = false;
        };

        devShells.default = pkgs.mkShell {
          # pnpm is NOT pulled from nixpkgs (it ships pnpm 11 which clashes with
          # the project's pnpm 10 lockfile). The devshell inherits the host PATH,
          # which has Pedro's pnpm 10 at ~/.local/bin/pnpm.
          # rustc + cargo pin the toolchain to the flake's nixpkgs rev —
          # lanes build with the SAME pinned rust the tauri-driver package
          # uses, never an unpinned host toolchain.
          packages = [
            pkgs.nodejs_22
            tauri-driver
            pkgs.rustc
            pkgs.cargo
          ] ++ tauriLinuxDeps;

          # bindgen (used transitively by several -sys crates) needs libclang.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";

          # Force host's pnpm 10 (at ~/.local/bin) to take precedence over any
          # nix-cached pnpm 11 — the project's lockfile is pnpm 10 format.
          shellHook = ''
            export PATH="$HOME/.local/bin:$PATH"
          '';
        };

        packages.tauri-driver = tauri-driver;
      });
}
