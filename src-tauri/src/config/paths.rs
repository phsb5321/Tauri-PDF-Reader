//! Where the config file lives.
//!
//! `$XDG_CONFIG_HOME/lectrice/config.toml` via `dirs::config_dir()`, with a
//! `LECTRICE_CONFIG` override.
//!
//! Deliberately NOT `app_config_dir()`: that resolves through the Tauri bundle
//! identifier, so the user's config path would change if the bundle identity
//! ever did, and it is not the path a `home-manager` user writes
//! (`xdg.configFile."lectrice/config.toml"`). The config path is part of the
//! user-facing contract, not of the packaging.

use std::path::PathBuf;

/// Environment variable that overrides the config path entirely.
pub const CONFIG_ENV_VAR: &str = "LECTRICE_CONFIG";

/// Directory name under `$XDG_CONFIG_HOME`.
pub const CONFIG_DIR_NAME: &str = "lectrice";

/// File name inside that directory.
pub const CONFIG_FILE_NAME: &str = "config.toml";

/// Resolve the config path.
///
/// Returns `None` only when there is no override AND the platform has no config
/// directory at all (a headless container with no `HOME`), in which case the
/// caller uses built-in defaults.
pub fn resolve() -> Option<PathBuf> {
    resolve_with(
        std::env::var_os(CONFIG_ENV_VAR).map(PathBuf::from),
        dirs::config_dir(),
    )
}

/// The pure core of [`resolve`], so both branches are testable without touching
/// the process environment (which is global state shared by parallel tests).
pub fn resolve_with(env_override: Option<PathBuf>, config_dir: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(path) = env_override {
        return Some(path);
    }
    config_dir.map(|dir| dir.join(CONFIG_DIR_NAME).join(CONFIG_FILE_NAME))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_override_wins_over_the_xdg_path() {
        let resolved = resolve_with(
            Some(PathBuf::from("/tmp/custom-lectrice.toml")),
            Some(PathBuf::from("/home/someone/.config")),
        );
        assert_eq!(resolved, Some(PathBuf::from("/tmp/custom-lectrice.toml")));
    }

    #[test]
    fn without_an_override_the_xdg_path_is_used() {
        let resolved = resolve_with(None, Some(PathBuf::from("/home/someone/.config")));
        assert_eq!(
            resolved,
            Some(PathBuf::from("/home/someone/.config/lectrice/config.toml"))
        );
    }

    #[test]
    fn no_override_and_no_config_dir_means_no_path() {
        assert_eq!(resolve_with(None, None), None);
    }
}
