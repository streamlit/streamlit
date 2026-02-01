# Prettier Setup Analysis

## Current State

### Dependency Distribution

Prettier (`^3.8.1`) is declared as a devDependency in **6 packages**:
- `frontend/app`
- `frontend/lib`
- `frontend/connection`
- `frontend/utils`
- `frontend/component-v2-lib`
- `frontend/eslint-plugin-streamlit-custom`

### Actual Installation

Due to **yarn workspace hoisting**, prettier is only installed once at `frontend/node_modules/.bin/prettier`. The individual packages don't have their own `node_modules/.bin/prettier` - they all share the hoisted version.

### Configuration

- **Single `.prettierrc`** at `frontend/` root
- **Single `.prettierignore`** at `frontend/` root
- Each package's `format` script references the root config:
  ```json
  "format": "prettier --write --config ../.prettierrc --ignore-path ../.prettierignore './src/**/*.{js,ts,jsx,tsx}'"
  ```

### ESLint Integration

Only `frontend/app` has ESLint-Prettier integration packages:
- `eslint-config-prettier`
- `eslint-plugin-prettier`

The root `frontend/eslint.config.mjs` uses `eslint-plugin-prettier/recommended`.

### Current Execution Methods

| Context | Command |
|---------|---------|
| Makefile `frontend-format` | `yarn workspaces foreach --all --parallel run format` |
| Makefile `make check` | `cd frontend && yarn exec prettier --write $FILES` |
| Pre-commit hook | `./scripts/run_in_subdirectory.py frontend node_modules/.bin/prettier --write` |

---

## Analysis

### What's Already Good

1. **Single installation** - Yarn hoisting already ensures only one copy of prettier exists
2. **Centralized config** - One `.prettierrc` and `.prettierignore` at the root
3. **Consistent version** - All packages specify the same version `^3.8.1`

### Issues with Current Setup

1. **Redundant declarations** - Prettier is declared in 6 packages but only needs to be in one place
2. **Relative path gymnastics** - Each package's format script uses `--config ../.prettierrc`
3. **Multiple execution patterns** - Three different ways to run prettier (workspace foreach, yarn exec, direct binary)
4. **ESLint integration only in app** - The ESLint-Prettier packages are only in `app` but the config is at root level

---

## Recommendation: Consolidate to Root

### Proposed Changes

1. **Move prettier to root `frontend/package.json`**:
   ```json
   {
     "devDependencies": {
       "prettier": "^3.8.1"
     }
   }
   ```

2. **Remove prettier from individual packages** (app, lib, connection, utils, component-v2-lib, eslint-plugin-streamlit-custom)

3. **Add root-level format scripts** to `frontend/package.json`:
   ```json
   {
     "scripts": {
       "format": "prettier --write './{app,lib,connection,utils}/src/**/*.{js,ts,jsx,tsx}'",
       "format:check": "prettier --check './{app,lib,connection,utils}/src/**/*.{js,ts,jsx,tsx}'"
     }
   }
   ```

4. **Simplify or remove per-package format scripts** (optional - can keep for backwards compatibility)

5. **Move ESLint-Prettier packages to root** (optional):
   - Move `eslint-config-prettier` and `eslint-plugin-prettier` to root `frontend/package.json`
   - Remove from `frontend/app/package.json`

### Benefits

| Benefit | Description |
|---------|-------------|
| **Simpler dependency management** | One place to update prettier version |
| **No relative path configs** | Root-level scripts don't need `--config ../` |
| **Cleaner pre-commit** | Can use `yarn format` or direct `prettier` call |
| **Consistent execution** | One canonical way to format |

### Risks & Considerations

1. **Yarn workspace behavior** - Yarn 4 with `nodeLinker: node-modules` hoists dependencies by default, so this change is mostly cosmetic for installation but improves maintainability.

2. **CI compatibility** - The change should be transparent to CI since prettier is already hoisted.

3. **IDE integration** - VS Code and other editors should continue to find prettier since it's in `frontend/node_modules/.bin/`.

4. **Backwards compatibility** - Individual package `format` scripts can remain for developers used to running `yarn format` from within a package.

---

## Quick Win: Minimal Change

If a full refactor is too risky, a minimal improvement:

1. Keep prettier declarations as-is (redundant but harmless since yarn hoists)
2. Add root-level format scripts to `frontend/package.json`
3. Standardize on one execution method across Makefile and pre-commit

This provides immediate simplification without touching individual package.json files.

---

## Conclusion

The current setup **works correctly** due to yarn hoisting, but has unnecessary complexity in the form of redundant dependency declarations and multiple execution patterns. Consolidating prettier to the root `frontend/package.json` would:

- Reduce maintenance burden (1 place to update versions)
- Simplify configuration (no relative paths needed)
- Align with modern monorepo best practices

**Recommendation**: Implement the consolidation as a follow-up PR after the current changes are merged and stable.
