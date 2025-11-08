import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      "dist",
      "dist/**",
      "build",
      "build/**",
      "**/dist",
      "**/dist/**",
      "**/build",
      "**/build/**",
      "**/node_modules",
      "**/node_modules/**",
      "**/.turbo",
      "**/.turbo/**",
      "**/coverage",
      "**/coverage/**",
      ".next",
      ".next/**",
      "**/.next",
      "**/.next/**",
      "**/.cache",
      "**/.cache/**",
      "**/out",
      "**/out/**",
      "**/*.min.js",
      "**/.vite",
      "**/.vite/**",
      "next-env.d.ts",
      "**/next-env.d.ts",
      "packages/landing/next-env.d.ts",
      "**/bundles/**",
      "packages/worker/bundles/**",
      "packages/worker/templates/**/bundles/**",
      "**/binaries/**",
      "packages/worker/binaries/**",
      "packages/worker/templates/**/binaries/**",
      "scripts/**",
      "packages/cf-tunnel/**",
      "packages/ui/demo.tsx",
      "packages/ui/src/EntitySelectDemo.tsx",
      "packages/ui/src/ComboboxDemo.tsx",
      "packages/worker/scripts/**",
    ],
  },

  // Base JavaScript configuration
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Code style
      "comma-dangle": ["error", "always-multiline"],
      "semi": ["error", "always"],
      "quotes": ["error", "double", { avoidEscape: true }],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "comma-spacing": ["error", { before: false, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "semi-spacing": ["error", { before: false, after: true }],

      // Best practices
      "prefer-template": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-case-declarations": "off",
    },
  },

  // TypeScript base configuration
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // TypeScript configuration
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: ["**/*.config.{ts,mts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Code style
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "semi-spacing": ["error", { before: false, after: true }],

      // TypeScript specific
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],

      // Best practices
      "prefer-template": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-case-declarations": "off",
    },
  },

  // React configuration for frontend packages
  {
    files: [
      "packages/client/**/*.{ts,tsx}",
      "packages/landing/**/*.{ts,tsx}",
      "packages/ui/**/*.{ts,tsx}",
    ],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Test files configuration
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Configuration files
  {
    files: ["**/*.config.{ts,mts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // TypeScript declaration files (auto-generated)
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
);
