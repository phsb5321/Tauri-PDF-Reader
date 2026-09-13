# Lectrice Linux desktop package — x86_64-linux.
# Mirrors the locked scheme of nix/lectrice-darwin.nix (same src, pnpmDeps
# hash, cargoLock, HUSKY=0, cargo-tauri.hook) and follows the UPSTREAM Linux
# hook recipe (measured from the pinned nixpkgs cargo-tauri hook + rclone-ui
# package): the hook's default deb install moves
# target/<triple>/release/bundle/deb/*/data/usr into $out (binary at
# bin/<mainBinaryName>), wrapGAppsHook3 provides the GApp/GST-aware wrapper,
# and this derivation adds the Lectrice contract extras: lectrice symlink,
# canonical .desktop with PDF MIME, hicolor icons, immutable version file.
{
  pkgs,
  src,
}: let
  inherit (pkgs) lib;
  manifest = lib.importJSON (src + /package.json);
  pnpm = pkgs.pnpm_10;

  # Real binary name: the Cargo package name (Tauri v2 default
  # mainBinaryName), proven by the Darwin bundle binary path
  # (Contents/MacOS/tauri-pdf-reader).
  binaryName = "tauri-pdf-reader";
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
      pkgs.makeWrapper
      pkgs.nodejs_22
      pkgs.perl
      pkgs.pkg-config
      pkgs.pnpmConfigHook
      pnpm
      pkgs.rustPlatform.bindgenHook
      pkgs.gobject-introspection
      # GApp/GStreamer-aware wrapping; consumes the tauri hook's GST asset
      # protocol/plugin arguments (a manual LD_LIBRARY_PATH wrapper ignores
      # those).
      pkgs.wrapGAppsHook3
    ];

    # Actual Linux -sys build/runtime deps for this app: rodio/cpal needs
    # ALSA; the crate tree pulls native-tls/openssl-sys; Tauri Linux needs
    # the WebKitGTK stack; GStreamer plugins serve WebKit media paths.
    buildInputs =
      [
        pkgs.alsa-lib
        pkgs.gtk3
        pkgs.openssl
        pkgs.webkitgtk_4_1
        pkgs.glib-networking
      ]
      ++ (with pkgs.gst_all_1; [
        gstreamer
        gst-plugins-base
        gst-plugins-good
        gst-plugins-bad
      ]);

    # package.json's prepare hook installs Husky into a Git checkout. A Nix
    # source has no writable .git directory, and release packaging needs no
    # developer hooks.
    env.HUSKY = "0";

    # Upstream hook default (deb) — its installScript moves the bundle's
    # data/usr into $out. doCheck stays off as in the Darwin scheme.
    doCheck = false;

    # Extra wrapper args beyond wrapGAppsHook3's defaults: ALSA must resolve
    # at runtime for rodio/cpal audio output.
    preFixup = ''
      gappsWrapperArgs+=(
        --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath [pkgs.alsa-lib]}
      )
    '';

    postInstall = ''
      binary="$out/bin/${binaryName}"
      test -x "$binary" || {
        echo "expected Linux binary missing after hook install: $binary" >&2
        ls "$out/bin" >&2 || true
        exit 1
      }
      ln -sf "$binary" "$out/bin/lectrice"

      icon_dir="$out/share/icons/hicolor"
      install -Dm644 ${src}/src-tauri/icons/32x32.png "$icon_dir/32x32/apps/lectrice.png"
      install -Dm644 ${src}/src-tauri/icons/128x128.png "$icon_dir/128x128/apps/lectrice.png"
      install -Dm644 ${src}/src-tauri/icons/icon.png "$icon_dir/256x256/apps/lectrice.png"

      install -Dm644 ${./lectrice.desktop} "$out/share/applications/lectrice.desktop"
      substituteInPlace "$out/share/applications/lectrice.desktop" \
        --replace "@LECTRICE@" "$out/bin/${binaryName}" \
        --replace "@VERSION@" "${finalAttrs.version}"

      # Plain immutable version metadata (217 updater validates without
      # executing the UI; no other version file exists in the package).
      install -Dm644 /dev/null "$out/share/lectrice/version"
      printf '%s\n' "${finalAttrs.version}" > "$out/share/lectrice/version"
    '';

    meta = {
      description = "Local-first PDF reader with synchronized narration";
      homepage = "https://github.com/phsb5321/Tauri-PDF-Reader";
      mainProgram = "lectrice";
      platforms = ["x86_64-linux"];
    };
  })
