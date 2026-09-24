import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".remember/**",
      "node_modules/**",
      // Was "extension/**", which excluded the entire extension source tree from
      // lint. The autofill engine's overlay renders employer-authored label text,
      // so the no-innerHTML rule below is a real XSS control -- it has to actually
      // run. Only build output and deps stay ignored.
      "extension/dist/**",
      "extension/node_modules/**",
      // TODO(lint-debt): extension/src/popup carries 23 pre-existing errors and 32
      // warnings (mostly no-explicit-any on Supabase row shapes, plus unused
      // lucide-react imports and one react-hooks/exhaustive-deps). Un-ignoring the
      // extension tree was done for the autofill engine's sake -- the overlay
      // renders untrusted employer text, so the no-innerHTML rule below has to
      // actually run -- and content/, background/, types/, lib/, extractors/ and
      // options/ are all clean and stay linted. The popup is quarantined rather
      // than either silently exempted from the rules or rewritten in the same
      // change as a schema migration. Delete this line and fix the 23.
      "extension/src/popup/**",
      "supabase/functions/**",
      "coverage/**",
      "public/**/*.min.*",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Node-context build configs. These are CommonJS by necessity -- webpack and
    // tailwind load them with require() -- so the TS import rule does not apply.
    // Surfaced by un-ignoring the extension tree; rewriting working build scripts
    // to ESM is not a thing a schema migration should be doing.
    files: ["extension/*.config.js", "*.config.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // The autofill overlay renders employer-authored label and option text inside
    // a page we do not control. Every insertion must go through textContent.
    // NOTE: no-restricted-properties has no wildcard `object` syntax -- an entry
    // like { object: "*", property: "innerHTML" } matches a literal identifier
    // named `*` and silently never fires. Omitting `object` is what restricts the
    // property on any object.
    files: ["extension/src/content/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent. Employer-authored page text is untrusted input." },
        { property: "outerHTML", message: "Use textContent. Employer-authored page text is untrusted input." },
        { property: "insertAdjacentHTML", message: "Use textContent. Employer-authored page text is untrusted input." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='submit']",
          message: "The autofill engine never submits a form. The human submits.",
        },
        {
          selector: "CallExpression[callee.property.name='requestSubmit']",
          message: "The autofill engine never submits a form. The human submits.",
        },
      ],
    },
  },
  {
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/error-boundaries": "off",
    },
  },
  {
    // Email templates render to static HTML; next/image does not apply
    files: ["emails/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]

export default eslintConfig
