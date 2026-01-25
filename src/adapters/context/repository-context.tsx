import { createContext, useContext, ReactNode } from 'react';
import type { DocumentRepositoryPort } from '../../ports/document-repository.port';
import type { HighlightRepositoryPort } from '../../ports/highlight-repository.port';
import type { TtsPort } from '../../ports/tts.port';
import type { SettingsPort } from '../../ports/settings.port';

/**
 * Repository context for dependency injection.
 *
 * This allows the application to swap between real Tauri adapters
 * (for production) and mock adapters (for testing).
 */
export interface RepositoryContextValue {
  documentRepository: DocumentRepositoryPort;
  highlightRepository: HighlightRepositoryPort;
  ttsAdapter: TtsPort;
  settingsAdapter: SettingsPort;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export interface RepositoryProviderProps {
  children: ReactNode;
  repositories: RepositoryContextValue;
}

/**
 * Provider component for injecting repository implementations.
 *
 * Usage:
 * ```tsx
 * // Production (main.tsx)
 * <RepositoryProvider repositories={{
 *   documentRepository: new TauriDocumentRepository(),
 *   highlightRepository: new TauriHighlightRepository(),
 *   ttsAdapter: new TauriTtsAdapter(),
 *   settingsAdapter: new TauriSettingsAdapter(),
 * }}>
 *   <App />
 * </RepositoryProvider>
 *
 * // Testing
 * <RepositoryProvider repositories={{
 *   documentRepository: new MockDocumentRepository(),
 *   highlightRepository: new MockHighlightRepository(),
 *   ttsAdapter: new MockTtsAdapter(),
 *   settingsAdapter: new MockSettingsAdapter(),
 * }}>
 *   <ComponentUnderTest />
 * </RepositoryProvider>
 * ```
 */
export function RepositoryProvider({
  children,
  repositories,
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * Hook to access all repositories.
 * @throws Error if used outside RepositoryProvider
 */
export function useRepositories(): RepositoryContextValue {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepositories must be used within a RepositoryProvider');
  }
  return context;
}

/**
 * Hook to access the document repository.
 * @throws Error if used outside RepositoryProvider
 */
export function useDocumentRepository(): DocumentRepositoryPort {
  return useRepositories().documentRepository;
}

/**
 * Hook to access the highlight repository.
 * @throws Error if used outside RepositoryProvider
 */
export function useHighlightRepository(): HighlightRepositoryPort {
  return useRepositories().highlightRepository;
}

/**
 * Hook to access the TTS adapter.
 * @throws Error if used outside RepositoryProvider
 */
export function useTtsAdapter(): TtsPort {
  return useRepositories().ttsAdapter;
}

/**
 * Hook to access the settings adapter.
 * @throws Error if used outside RepositoryProvider
 */
export function useSettingsAdapter(): SettingsPort {
  return useRepositories().settingsAdapter;
}
