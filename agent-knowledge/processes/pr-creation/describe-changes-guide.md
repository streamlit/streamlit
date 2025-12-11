---
status: stable
last_updated: 2025-12-02
---

# Guide: Describing Changes

Use this guide for PR template sections that ask what changed (e.g., "Describe your changes").

## Content Guidelines

**Keep it brief:** 2-4 bullets maximum for listing changes.

**List only impactful changes** - not every file touched.

**Omit obvious details** - don't explain what's clear from reading the code.

**Explain non-obvious decisions** - only include implementation details that aren't obvious.

## Selectivity Checklist

Before including a change, ask:

1. **Is this obvious?** → Omit it
2. **Is this a standard pattern?** (tests, types, validation) → Omit it
3. **Is this the most impactful change?** → Include it
4. **Does this involve a non-obvious decision?** → Include it with explanation

## Example: Feature Adding a Parameter

**What to include:**

- ✓ New parameter added (the main change)
- ✓ Deprecation of old parameter (impacts users)
- ✓ Non-obvious behavior (special handling, fallbacks)

**What to omit:**

- ✗ Added tests (obvious)
- ✗ Updated types (obvious)
- ✗ Added validation (obvious)
- ✗ Updated proto (implementation detail)
- ✗ Fixed linting (housekeeping)

## Good vs Bad Examples

**Good (selective, highlights what matters):**

> Adds `height` parameter to `st.plotly_chart()` using `Height` type system.
>
> - Added `height` parameter with default `"stretch"`
> - Deprecates `use_container_height` (removed after 2025-12-31)

**Bad (lists every change):**

> - Added `height: Height = "stretch"` parameter to st.plotly_chart signature
> - Updated layout config dataclass to accept height parameter
> - Added validation for height parameter values
> - Updated proto message to include height field
> - Added unit tests for height parameter
> - Added E2E tests for height visual behavior
> - Updated type hints in plotly_chart.py

**Why bad:** Most of these are obvious. Only list what's non-obvious or impactful.

## Implementation Notes

If the change involves non-obvious behavior, add a brief explanation:

**Good:**

> When `height="content"`, extracts height from native Plotly figure if specified, falls back to `"stretch"` otherwise.

**Bad:**

> The height parameter is validated to ensure only valid values are accepted.

**Why bad:** This is obvious - of course parameters are validated.
