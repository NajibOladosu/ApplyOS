import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "extension/**",
      "supabase/functions/**",
      "build.log",
      "fix-imports.js",
      "fix-paths.js",
    ],
  },
]
