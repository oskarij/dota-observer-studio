import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

const projectRules = {
  'react/boolean-prop-naming': 'error',
  'react/button-has-type': 'error',
  'react/default-props-match-prop-types': 'error',
  'react/display-name': 'off',
  'react/forbid-dom-props': 'error',
  'react/forbid-elements': 'error',
  'react/forbid-foreign-prop-types': 'error',
  'react/jsx-boolean-value': 'error',
  'react/jsx-curly-brace-presence': 'error',
  'react/jsx-curly-spacing': 'error',
  'react/jsx-equals-spacing': 'error',
  'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
  'react/jsx-no-useless-fragment': 'error',
  'react/jsx-props-no-multi-spaces': 'error',
  'react/no-access-state-in-setstate': 'error',
  'react/no-did-mount-set-state': 'error',
  'react/no-did-update-set-state': 'error',
  'react/no-redundant-should-component-update': 'error',
  'react/no-this-in-sfc': 'error',
  'react/no-typos': 'error',
  'react/no-unused-prop-types': 'error',
  'react/no-unused-state': 'error',
  'react/no-will-update-set-state': 'error',
  'react/prefer-es6-class': 'error',
  'react/prop-types': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/sort-default-props': 'error',
  'react/sort-prop-types': 'error',
  'react/style-prop-object': 'error',
  'react/void-dom-elements-no-children': 'error',
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
    ignores: ['.svelte-kit/**', 'build/**', 'dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
        projectService: {
          allowDefaultProject: ['*.config.js', 'eslint.config.js']
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: {
        version: '19.0'
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
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['**/*.{jsx,tsx}'],
    ...react.configs.flat.recommended,
    settings: {
      react: {
        version: '19.0'
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...projectRules
    }
  }
);
