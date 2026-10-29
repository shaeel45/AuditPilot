import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config.
 * NOTE: type-safety rules are intentionally loose for this first commit
 * (the legacy codebase uses `any` heavily). Tightened progressively in later
 * architecture commits.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "script/**",
      "*.cjs",
      "client/public/**",
      "attached_assets/**",
      ".local/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
    },
  },
);
