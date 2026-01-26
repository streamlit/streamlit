---
status: experimental
last_updated: 2025-11-05
---

# Branch Naming - Best Practices

## Format

```
{type}/{brief-description}
```

## Types

- `feature` - New features or functionality
- `fix` - Bug fixes
- `refactor` - Code refactoring
- `chore` - Maintenance tasks (dependencies, tooling, etc.)
- `docs` - Documentation changes

## Guidelines

**Good branch names:**

- Descriptive and specific (3-6 words typical, up to 8 for complex changes)
- Use kebab-case (hyphens between words)
- Clearly indicate what is being changed and why
- Include the component/area being modified when helpful
- Avoid ticket/issue numbers (use PR description for that)

**Format patterns:**

- `{type}/{action}-{component}-{detail}` - e.g., `feature/add-height-plotly-charts`
- `{type}/{area}-{specific-change}` - e.g., `fix/dataframe-memory-leak-scrolling`
- `{type}/{what-is-changing}` - e.g., `refactor/arrow-table-conversion-logic`

## Examples

- `feature/add-height-parameter-plotly-charts` - Adding new parameter to specific component
- `fix/dataframe-memory-leak-large-datasets` - Fixing specific bug with context
- `refactor/element-width-height-logic` - Refactoring specific area of codebase
- `chore/update-react-dependencies` - Maintenance task with specific scope
- `docs/api-reference-layout-parameters` - Documentation update for specific section
