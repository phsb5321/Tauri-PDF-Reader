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
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          # pnpm is NOT pulled from nixpkgs (it ships pnpm 11 which clashes with
          # the project's pnpm 10 lockfile). The devshell inherits the host PATH,
          # which has Pedro's pnpm 10 at ~/.local/bin/pnpm.
          packages = [ pkgs.nodejs_22 ] ++ tauriLinuxDeps;

          # bindgen (used transitively by several -sys crates) needs libclang.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";

          # Force host's pnpm 10 (at ~/.local/bin) to take precedence over any
          # nix-cached pnpm 11 — the project's lockfile is pnpm 10 format.
          shellHook = ''
            export PATH="$HOME/.local/bin:$PATH"
          '';
        };
      });
}
