import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

const projectRules = {
  'callback-return': 'error',
  camelcase: 'error',
  'comma-dangle': ['error', 'never'],
  'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
  'global-require': 'error',
  'init-declarations': 'error',
  'no-alert': 'error',
  'no-bitwise': 'error',
  'no-console': 'error',
  'no-constant-condition': 'error',
  'no-implicit-coercion': 'error',
  'no-nested-ternary': 'error',
  'no-new-func': 'error',
  'no-param-reassign': 'error',
  'no-process-env': 'error',
  'no-process-exit': 'error',
  'no-return-assign': 'error',
  'no-sync': 'error',
  'no-warning-comments': 'error',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/consistent-type-definitions': 'error',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  '@typescript-eslint/no-deprecated': 'off',
  '@typescript-eslint/no-duplicate-type-constituents': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/no-invalid-void-type': 'off',
  '@typescript-eslint/no-misused-promises': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-shadow': 'error',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/no-unnecessary-type-arguments': 'off',
  '@typescript-eslint/no-unnecessary-type-parameters': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }
  ],
  '@typescript-eslint/prefer-enum-initializers': 'error',
  '@typescript-eslint/prefer-promise-reject-errors': 'off',
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    {
      allowNullish: true,
      allowBoolean: true,
      allowNumber: true,
      allowArray: true,
      allowNever: true
    }
  ],
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off'
};

export default tseslint.config(
  {
    ignores: [
      '.dev/**',
      '.svelte-kit/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'tools/*.mjs',
      'tests/integration/*.mjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        projectService: {
          allowDefaultProject: [
            '*.config.js',
            'eslint.config.js',
            'vite.overlay.config.ts',
            'src/electron/preload.cts'
          ]
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: projectRules
  },
  {
    files: ['*.config.js', 'eslint.config.js'],
    rules: {
      ...tseslint.configs.disableTypeChecked.rules
    }
  },
  {
    files: [
      'src/runtime/**/*.ts',
      'src/persistence/**/*.ts',
      'src/electron/ipc/**/*.ts',
      'src/lib/state/**/*.ts'
    ],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error'
    }
  },
  {
    files: [
      'src/runtime/rosterService.ts',
      'src/runtime/fearlessService.ts',
      'src/persistence/validatedSettings.ts',
      'src/shared/configValidation.ts'
    ],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error'
    }
  },
  {
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: tseslint.parser
    }
  },
  {
    // Test fixtures and the preview sample mirror Dota's snake_case GSI payload shape verbatim.
    files: ['tests/**/*.ts', 'src/lib/dev/sampleGsiData.ts', 'src/shared/overlayPayload.ts'],
    rules: {
      camelcase: ['error', { properties: 'never' }]
    }
  },
  {
    files: ['src/lib/components/ui/**/*.{svelte,ts}', 'src/lib/hooks/**/*.svelte.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      'comma-dangle': 'off',
      'no-undef': 'off',
      'svelte/no-navigation-without-resolve': 'off'
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  }
);
