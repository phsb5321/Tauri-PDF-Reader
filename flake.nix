{
  description = "Lectrice — Tauri 2 PDF reader devshell (spec 042: Android target spike)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    fenix.url = "github:nix-community/fenix";
    fenix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, fenix }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.android_sdk.accept_license = true;
          config.allowUnfree = true;
        };

        # nixpkgs 26.11 removed `androidenv.androidsdk`; composeAndroidPackages is the live API.
        androidEnv = pkgs.androidenv.override { licenseAccepted = true; };
        androidComp = androidEnv.composeAndroidPackages {
          platformVersions = [ "35" ];
          buildToolsVersions = [ "35.0.0" ];
          includeNDK = true;
          includeEmulator = true;
          includeSystemImages = true;
          systemImageTypes = [ "default" ];
          # x86_64 only for the spike: KVM-accelerated on this host. arm64-v8a is
          # software-emulated → unusably slow; add it later when shipping to POCO Pad.
          abiVersions = [ "x86_64" ];
          cmdLineToolsVersion = "latest";
        };

        androidSdkPath = "${androidComp.androidsdk}/libexec/android-sdk";

        # Rust stable + Android std libs fused (no rustup needed on NixOS).
        rustToolchain = fenix.packages.${system}.combine [
          fenix.packages.${system}.stable.toolchain
          fenix.packages.${system}.targets.aarch64-linux-android.stable.rust-std
          fenix.packages.${system}.targets.x86_64-linux-android.stable.rust-std
          fenix.packages.${system}.targets.armv7-linux-androideabi.stable.rust-std
          fenix.packages.${system}.targets.i686-linux-android.stable.rust-std
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            rustToolchain
            pkgs.jdk17
            pkgs.nodejs_22
            pkgs.pnpm
            androidComp.androidsdk
            pkgs.llvmPackages.libclang
          ];

          ANDROID_HOME = androidSdkPath;
          ANDROID_SDK_ROOT = androidSdkPath;
          NDK_HOME = "${androidSdkPath}/ndk-bundle";
          JAVA_HOME = "${pkgs.jdk17}";

          # NixOS no-FHS workaround: gradle otherwise downloads its own aapt2
          # which can't find its interpreter. Force the nixpkgs-provided one.
          GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${androidSdkPath}/build-tools/35.0.0/aapt2";

          # bindgen (signalsmith-stretch) needs libclang.so. The .lib output has it
          # (the wrapper `llvmPackages.libclang` has only bin+share, no .so).
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";

          shellHook = ''
            echo ""
            echo "🎮 Lectrice Android devshell (spec 042)"
            echo "  ANDROID_HOME=$ANDROID_HOME"
            echo "  NDK_HOME=$NDK_HOME"
            echo "  JAVA_HOME=$JAVA_HOME"
            echo "  rustc: $(rustc --version)"
            echo ""
            echo "Spike flow:"
            echo "  pnpm install"
            echo "  pnpm tauri android init"
            echo "  pnpm tauri android dev   # boots x86_64 emulator"
            echo ""
          '';
        };
      });
}
