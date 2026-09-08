import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Co-exporting a hook with its provider (useAuth + AuthProvider,
    // useTheme + ThemeProvider) and a CVA variant map with its component
    // (buttonVariants + Button) are standard, accepted patterns — the
    // fast-refresh rule's warning about them is a soft guideline, not a
    // correctness issue, so it's disabled for these specific files rather
    // than splitting idiomatic single-concept files in two.
    files: [
      'src/components/ui/**/*.tsx',
      'src/features/auth/auth-provider.tsx',
      'src/app/theme-provider.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
