import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      boundaries,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      // Boundaries plugin settings
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/*' },
        { type: 'ports', pattern: 'src/ports/*' },
        { type: 'application', pattern: 'src/application/*' },
        { type: 'adapters', pattern: 'src/adapters/*' },
        { type: 'components', pattern: 'src/components/*' },
        { type: 'hooks', pattern: 'src/hooks/*' },
        { type: 'stores', pattern: 'src/stores/*' },
        { type: 'lib', pattern: 'src/lib/*' },
        { type: 'tests', pattern: 'src/__tests__/*' },
      ],
      'boundaries/ignore': [
        '**/node_modules/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
    rules: {
      // Hexagonal Architecture Boundaries
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // Domain layer: can only import from domain and ports (interfaces)
            {
              from: 'domain',
              allow: ['domain', 'ports'],
            },
            // Ports layer: standalone, no dependencies
            {
              from: 'ports',
              allow: ['ports'],
            },
            // Application layer: can import from domain and ports
            {
              from: 'application',
              allow: ['domain', 'ports', 'application'],
            },
            // Adapters layer: can import from ports and domain (for types)
            {
              from: 'adapters',
              allow: ['ports', 'domain', 'adapters'],
            },
            // Components (UI): can import from ports, domain, hooks, stores, lib, components
            {
              from: 'components',
              allow: ['ports', 'domain', 'hooks', 'stores', 'lib', 'components'],
            },
            // Hooks: can import from ports, domain, application, stores, lib, hooks, adapters
            {
              from: 'hooks',
              allow: ['ports', 'domain', 'application', 'stores', 'lib', 'hooks', 'adapters'],
            },
            // Stores: can import from ports, domain, lib, stores
            {
              from: 'stores',
              allow: ['ports', 'domain', 'lib', 'stores'],
            },
            // Lib: can import from domain, lib, and external modules
            {
              from: 'lib',
              allow: ['domain', 'lib'],
            },
            // Tests: can import from anywhere
            {
              from: 'tests',
              allow: ['*'],
            },
          ],
        },
      ],
      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // Using TypeScript
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',

      // Restrict direct Tauri API usage to adapters layer only
      // This ensures all IPC calls go through type-safe adapters
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@tauri-apps/api/core',
              message:
                'Direct invoke() calls are not allowed. Use type-safe adapters from src/adapters/ or the generated bindings in src/lib/bindings.ts instead.',
            },
          ],
        },
      ],
    },
  },
  // Allow generated bindings file to import from Tauri API and use @ts-nocheck
  {
    files: ['src/lib/bindings.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Allow legacy tauri-invoke.ts during migration (to be removed)
  {
    files: ['src/lib/tauri-invoke.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Allow adapters to import from Tauri API (they're the integration layer)
  {
    files: ['src/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Allow lib/api/* - Tauri command wrappers (adapter layer)
  {
    files: ['src/lib/api/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Allow legacy services during migration (to be refactored to use adapters)
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Allow DebugLogs component until logging is migrated to typed bindings
  {
    files: ['src/components/settings/DebugLogs.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      '*.config.js',
      '*.config.ts',
    ],
  }
);
