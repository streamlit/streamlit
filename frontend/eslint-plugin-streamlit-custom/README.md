# ESLint Plugin Streamlit Custom

A TypeScript-based ESLint plugin package for Streamlit-specific linting rules.

## Development

### Development Workflow

When making changes to this plugin during development:

1. Make your changes to the plugin code
1. Restart the ESLint server in any packages that use this plugin to pick up the changes
   - In VS Code: Use the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run "ESLint: Restart ESLint Server"
   - Or restart your IDE/editor

This is necessary because ESLint caches the plugin and won't automatically pick up changes until the server is restarted.

### Common Commands:

- `yarn test` - Run the tests
- `yarn testWatch` - Run the tests and watch for changes
- `yarn typecheck` - Run the type checker

## Usage in a Package

```javascript
import { createJiti } from "jiti"

// This is to support our custom rules, which are written in TypeScript,
// but need to be imported as JS to work in ESLint.
const jiti = createJiti(import.meta.url)
const __dirname = path.dirname(__filename)
const streamlitCustom = await jiti.import(
  path.resolve(__dirname, "./eslint-plugin-streamlit-custom/src/index.ts"),
  { default: true }
)

export default [
  {
    plugins: {
      "streamlit-custom": streamlitCustom,
    },
    rules: {
      "streamlit-custom/use-strict-null-equality-checks": "error",
      "streamlit-custom/no-hardcoded-theme-values": "error",
      "streamlit-custom/enforce-memo": "error",
    },
  },
]
```
