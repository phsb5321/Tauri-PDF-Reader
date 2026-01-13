import { useEffect, useCallback } from 'react';
import { useSettingsStore, Theme } from '../stores/settings-store';

/**
 * Hook to manage theme state and apply CSS variables
 * - Syncs theme setting with document root attribute
 * - Listens to system theme changes when in 'system' mode
 */
export function useTheme() {
  const { theme, setTheme } = useSettingsStore();

  // Apply theme to document root
  const applyTheme = useCallback((themeValue: Theme) => {
    const root = document.documentElement;

    if (themeValue === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', themeValue);
    }
  }, []);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // Get the effective/resolved theme (accounting for system preference)
  const effectiveTheme = useCallback((): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  return {
    theme,
    effectiveTheme: effectiveTheme(),
    setTheme,
    applyTheme,
  };
}
