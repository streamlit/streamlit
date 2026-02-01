# ESLint Setup Analysis

## Current State

### Dependency Distribution

ESLint (`^9.39.2`) is declared as a devDependency in **6 packages**:
- `frontend/app` - **full set of plugins** (15+ ESLint-related packages)
- `frontend/lib` - minimal (eslint + custom plugin)
- `frontend/connection` - minimal (eslint only)
- `frontend/utils` - minimal (eslint only)
- `frontend/component-v2-lib` - minimal (eslint only)
- `frontend/eslint-plugin-streamlit-custom` - minimal (eslint only)

### Actual Installation

Due to **yarn workspace hoisting**, eslint is only installed once at `frontend/node_modules/.bin/eslint`. The individual packages share the hoisted version.

### Configuration Structure

```
frontend/
├── eslint.config.mjs          # Root config - comprehensive rules (~350 lines)
├── app/
│   └── eslint.config.mjs      # Extends root, adds app-specific import restrictions
├── lib/                       # No config - uses root directly
├── connection/                # No config - uses root directly
├── utils/                     # No config - uses root directly
└── component-v2-lib/          # No config - uses root directly
```

### Plugin Distribution (Current)

| Plugin | Location |
|--------|----------|
| `eslint` (core) | app, lib, connection, utils, component-v2-lib, eslint-plugin-custom |
| `@eslint/js` | app only |
| `@eslint-react/eslint-plugin` | app only |
| `eslint-config-prettier` | app only |
| `eslint-plugin-prettier` | app only |
| `eslint-plugin-import` | app only |
| `eslint-plugin-jsx-a11y` | app only |
| `eslint-plugin-lodash` | app only |
| `eslint-plugin-react` | app only |
| `eslint-plugin-react-hooks` | app only |
| `eslint-plugin-testing-library` | app only |
| `eslint-plugin-no-relative-import-paths` | app only |
| `eslint-plugin-streamlit-custom` | app, lib (workspace link) |
| `typescript-eslint` | (imported in config, not in package.json?) |

### Current Execution Methods

| Context | Command |
|---------|---------|
| Makefile `frontend-lint` | `yarn workspaces foreach --all --parallel run lint` |
| Makefile `make check` | `cd frontend && ./node_modules/.bin/eslint --fix $FILES` |
| Per-package scripts | `eslint --cache --max-warnings 0 src` |

---

## Analysis

### What's Already Good

1. **Single installation** - Yarn hoisting ensures one ESLint binary
2. **Centralized config** - Root `eslint.config.mjs` contains all shared rules
3. **Flat config (ESLint 9)** - Modern config format, easier to extend
4. **Config inheritance** - `app/eslint.config.mjs` cleanly extends root config
5. **Custom plugin** - `eslint-plugin-streamlit-custom` for Streamlit-specific rules

### Issues with Current Setup

1. **Asymmetric plugin distribution** - All plugins are in `app` but the config is at root level
   - Root config imports plugins that are only declared in `app/package.json`
   - This works due to hoisting but is fragile and confusing

2. **Redundant core ESLint declarations** - ESLint declared in 6 packages

3. **Missing explicit dependencies** - Root config imports `typescript-eslint`, `globals`, etc. but these aren't in any package.json (relies on transitive dependencies)

4. **Inconsistent lint execution** - Three different methods (workspace foreach, direct binary, per-package scripts)

---

## Recommendation: Consolidate to Root

### Proposed Changes

1. **Move all ESLint plugins to root `frontend/package.json`**:
   ```json
   {
     "devDependencies": {
       "eslint": "^9.39.2",
       "@eslint/js": "^9.39.2",
       "@eslint-react/eslint-plugin": "^2.7.4",
       "eslint-config-prettier": "^10.1.8",
       "eslint-plugin-import": "^2.32.0",
       "eslint-plugin-jsx-a11y": "^6.10.2",
       "eslint-plugin-lodash": "^8.0.0",
       "eslint-plugin-no-relative-import-paths": "^1.6.1",
       "eslint-plugin-prettier": "^5.5.5",
       "eslint-plugin-react": "^7.37.5",
       "eslint-plugin-react-hooks": "^7.0.1",
       "eslint-plugin-testing-library": "^7.15.4",
       "typescript-eslint": "^8.x.x",
       "globals": "^15.x.x",
       "@vitest/eslint-plugin": "^x.x.x"
     }
   }
   ```

2. **Remove ESLint from individual packages** (app, lib, connection, utils, component-v2-lib)
   - Keep `eslint-plugin-streamlit-custom` as workspace dependency

3. **Add root-level lint scripts** to `frontend/package.json`:
   ```json
   {
     "scripts": {
       "lint": "eslint --cache --max-warnings 0 .",
       "lint:fix": "eslint --cache --max-warnings 0 --fix ."
     }
   }
   ```

4. **Update or remove per-package lint scripts** (optional - can keep for backwards compatibility)

### Benefits

| Benefit | Description |
|---------|-------------|
| **Explicit dependencies** | All imports in config have matching package.json entries |
| **Simpler maintenance** | One place to update ESLint and plugin versions |
| **Cleaner package.json** | Individual packages don't need ESLint declarations |
| **Consistent execution** | One canonical way to lint |

### Risks & Considerations

1. **IDE integration** - VS Code ESLint extension should still work since `node_modules/.bin/eslint` location doesn't change

2. **TypeScript project references** - The root `tsconfig.json` uses project references; ESLint's `projectService` should handle this correctly

3. **Per-package overrides** - `app/eslint.config.mjs` can remain for app-specific rules; it already extends the root config cleanly

4. **CI compatibility** - Change should be transparent to CI

### Package-Specific Rules Still Work

**Important:** Consolidating plugins to the root does NOT prevent package-specific rules. Plugin installation and rule configuration are separate concerns:

- **Plugins at root** = Available in `node_modules` for all packages
- **Rules per-package** = Each package's `eslint.config.mjs` controls which rules are enabled

The current `app/eslint.config.mjs` already demonstrates this pattern:

```javascript
// frontend/app/eslint.config.mjs
import baseConfig, { getNoRestrictedImports } from "../eslint.config.mjs"

const LIB_RESTRICTION_PATTERN = {
  group: ["~lib/*"],
  message: "Direct imports from '~lib/*' are not allowed...",
}

export default [
  ...baseConfig,  // Inherit all root rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // App-specific rule override - only applies to this package
      "no-restricted-imports": getNoRestrictedImports([
        LIB_RESTRICTION_PATTERN,
      ]),
    },
  },
]
```

**Scenarios that work with root-installed plugins:**

| Scenario | Implementation |
|----------|----------------|
| Plugin only used in `app` | Install at root, only enable rules in `app/eslint.config.mjs` |
| Stricter rules for `lib` | Create `lib/eslint.config.mjs`, extend root, add stricter rules |
| Disable rule for `utils` | Create `utils/eslint.config.mjs`, turn off specific rules |
| Package-specific plugin | Install at root, import only in that package's config |

**Example: Adding a lib-specific rule**

```javascript
// frontend/lib/eslint.config.mjs (new file)
import baseConfig from "../eslint.config.mjs"

export default [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Stricter rule only for lib
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]
```

---

## Quick Win: Minimal Change

If a full refactor is too risky:

1. **Add missing explicit dependencies** to `frontend/app/package.json`:
   - `typescript-eslint`
   - `globals`
   - `@vitest/eslint-plugin`

2. **Document the current architecture** - Add comments explaining plugin hoisting

3. **Standardize execution** - Use one method consistently

---

## Comparison: Current vs Recommended

| Aspect | Current | Recommended |
|--------|---------|-------------|
| ESLint core | 6 packages | 1 (root) |
| Plugins | app only | root |
| Config | root + app override | root + app override (no change) |
| Lint scripts | per-package | root + per-package (optional) |
| Dependency clarity | Implicit (hoisting) | Explicit |

---

## Conclusion

The ESLint setup is **more problematic than Prettier** because:

1. The root config imports 15+ plugins that are only declared in `app/package.json`
2. Some dependencies (typescript-eslint, globals) aren't explicitly declared anywhere
3. This works by accident due to yarn hoisting but could break unpredictably

**Recommendation**: Move all ESLint-related dependencies to root `frontend/package.json` to make dependencies explicit and maintainable. This is a higher priority than the Prettier consolidation.
