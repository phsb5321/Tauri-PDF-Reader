{
  pkgs,
  src,
}: let
  inherit (pkgs) lib;
  manifest = lib.importJSON (src + /package.json);
  pnpm = pkgs.pnpm_10;
in
  pkgs.rustPlatform.buildRustPackage (finalAttrs: {
    pname = "lectrice";
    inherit (manifest) version;
    inherit src;

    cargoRoot = "src-tauri";
    buildAndTestSubdir = "src-tauri";
    cargoLock.lockFile = src + /src-tauri/Cargo.lock;

    pnpmDeps = pkgs.fetchPnpmDeps {
      inherit (finalAttrs) pname version src;
      inherit pnpm;
      fetcherVersion = 4;
      hash = "sha256-k8HBJ7LA/U3Ory3pjQagDfF1SzKTBL7CnAsoEYnBj3Y=";
    };

    nativeBuildInputs = [
      pkgs.cargo-tauri.hook
      pkgs.nodejs_22
      pkgs.perl
      pkgs.pkg-config
      pkgs.pnpmConfigHook
      pnpm
      pkgs.rustPlatform.bindgenHook
    ];

    # package.json's prepare hook installs Husky into a Git checkout. A Nix
    # source has no writable .git directory, and release packaging needs no
    # developer hooks.
    env.HUSKY = "0";

    # cargo-tauri.hook invokes the existing beforeBuildCommand (`pnpm build`)
    # exactly once, then emits only the native Darwin `app` bundle.
    tauriBundleType = "app";
    doCheck = false;

    # Preserve the linker-produced arm64 signature until the final app bundle
    # is sealed below. Stripping after codesign would invalidate the signature.
    dontStrip = true;

    postInstall = ''
      app="$out/Applications/Lectrice.app"
      executable="$app/Contents/MacOS/tauri-pdf-reader"
      test -x "$executable"

      mkdir -p "$out/bin"
      ln -s "$executable" "$out/bin/lectrice"
      install -m 755 ${src}/scripts/verify-macos-flake.sh "$out/bin/verify-macos-flake.sh"
      install -m 755 ${src}/scripts/manage-macos-flake.sh "$out/bin/manage-macos-flake.sh"
    '';

    # Apple silicon requires signed Mach-O code. The linker already ad-hoc
    # signs the executable; sealing the bundle after Nix fixups also binds its
    # Info.plist/resources. This is deliberately ad-hoc personal distribution,
    # not Apple Developer signing or notarization.
    postFixup = ''
      app="$out/Applications/Lectrice.app"
      /usr/bin/codesign --force --sign - "$app/Contents/MacOS/tauri-pdf-reader"
      /usr/bin/codesign --force --sign - "$app"
      /usr/bin/codesign --verify --deep --strict "$app"
    '';

    meta = {
      description = "Local-first PDF reader with synchronized narration";
      homepage = "https://github.com/phsb5321/Tauri-PDF-Reader";
      mainProgram = "lectrice";
      platforms = ["aarch64-darwin"];
    };
  })
