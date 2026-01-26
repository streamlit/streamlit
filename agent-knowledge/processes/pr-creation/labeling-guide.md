---
status: experimental
last_updated: 2025-11-05
---

# PR Labeling Guide

All Streamlit PRs must have the following labels applied.

## Required Labels

### 1. Security Assessment

- `security-assessment-completed` - Required for all PRs

### 2. Impact Classification

Choose **one**:

- `impact:users` - Changes will affect behavior for users
- `impact:internal` - Changes will not affect user behavior

### 3. Change Type

Choose **one**:

- `change:feature` - New features or feature enhancements
- `change:bugfix` - Bug fixes
- `change:chore` - Small changes for repo maintenance
- `change:refactor` - Refactoring changes to improve code quality
- `change:other` - Things that don't fit other categories
- `change:docs` - Documentation updates, e.g. docstring only changes

## Label Combination Examples

**For new features:**

- `security-assessment-completed`
- `impact:users` (changes user-facing API)
- `change:feature` (adds new functionality)

**For internal refactoring:**

- `security-assessment-completed`
- `impact:internal` (no user behavior change)
- `change:refactor` (improves code quality)

**For bug fixes:**

- `security-assessment-completed`
- `impact:users` (fixes user-facing issue)
- `change:bugfix` (fixes a bug)

**For documentation updates:**

- `security-assessment-completed`
- `impact:internal` (no behavior change)
- `change:docs` (documentation)
