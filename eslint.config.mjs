import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

const unusedVars = [
  "warn",
  // Variables starting with "_" are intentionally unused (e.g. fields dropped when copying records).
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrors: "none" },
];

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "backend/src/generated/**",
    ".local/**",
    "test-results/**",
    "playwright-report/**",
  ]),

  // Server side and tooling: Node.js
  {
    files: ["backend/**/*.js", "shared/**/*.js", "e2e/**/*.js", "*.config.js", "*.config.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
    rules: { "no-unused-vars": unusedVars },
  },

  // Browser: the React app
  {
    files: ["frontend/**/*.{js,jsx}"],
    extends: [js.configs.recommended, react.configs.flat.recommended, react.configs.flat["jsx-runtime"]],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": unusedVars,
      "react/prop-types": "off", // plain JavaScript project: props are documented in comments instead
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // shadcn/ui kit files are vendored as generated; keep them close to upstream.
  {
    files: ["frontend/src/components/ui/**"],
    rules: { "no-unused-vars": "off", "react-refresh/only-export-components": "off" },
  },

  // Folder boundaries (README §10 "Folder structure"). A wrong import fails lint and the pre-commit hook.
  {
    files: ["frontend/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/backend/**", "@acp/backend", "@acp/backend/*"],
              message: "The React app talks to the backend only through the API (src/lib/api.js, src/lib/actions.js).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/frontend/**", "@acp/frontend", "@acp/frontend/*"],
              message: "The API must not import UI code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/frontend/**", "**/backend/**", "@acp/frontend*", "@acp/backend*"],
              message: "shared/ must stay independent: it is used by both the browser and the server.",
            },
          ],
        },
      ],
    },
  },
]);
