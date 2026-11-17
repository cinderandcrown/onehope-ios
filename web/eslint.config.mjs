import next from "eslint-config-next";
import tseslint from "typescript-eslint";

const config = [
  ...next,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  { ignores: ["test-results/**", "playwright-report/**"] },
];

export default config;
