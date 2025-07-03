# ESLint Plugin Streamlit Custom

A TypeScript-based ESLint plugin for Streamlit-specific linting rules.

## Features

- **TypeScript Support**: Fully written in TypeScript with proper type definitions
- **Library Build**: Built as a proper library with ES modules, CommonJS, and UMD formats
- **Modern Tooling**: Uses Vite for building and Vitest for testing

## Rules

- `use-strict-null-equality-checks`: Enforce strict null equality checks
- `no-hardcoded-theme-values`: Prevent hardcoded theme values
- `enforce-memo`: Enforce proper use of React.memo

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm run test
```

### Type Checking

```bash
npm run typecheck
```

## Usage

```javascript
import eslintPluginStreamlitCustom from "eslint-plugin-streamlit-custom"

export default [
  {
    plugins: {
      "streamlit-custom": eslintPluginStreamlitCustom,
    },
    rules: {
      "streamlit-custom/use-strict-null-equality-checks": "error",
      "streamlit-custom/no-hardcoded-theme-values": "error",
      "streamlit-custom/enforce-memo": "error",
    },
  },
]
```

## Migration from JavaScript

The plugin has been migrated from JavaScript to TypeScript. The old JavaScript files are still present but the TypeScript versions in the `src/` directory are now the source of truth. The JavaScript implementations need to be migrated to the TypeScript files.

## Build Output

The build process generates:

- `dist/eslint-plugin-streamlit-custom.es.js` - ES module format
- `dist/eslint-plugin-streamlit-custom.cjs.js` - CommonJS format
- `dist/eslint-plugin-streamlit-custom.umd.js` - UMD format
- `dist/index.d.ts` - TypeScript declarations
