import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disable template literal restrictions (Discord.js uses many object types)
      "@typescript-eslint/restrict-template-expressions": "off",
      // Allow return await everywhere (simpler for bot commands)
      "@typescript-eslint/return-await": "off",
      // Allow non-null assertions in bot commands (Discord.js patterns)
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Allow deprecated APIs with warning (discord.js updates)
      "@typescript-eslint/no-deprecated": "warn",
      // Relax unnecessary condition checks
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Allow base-to-string for Discord objects
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
);
