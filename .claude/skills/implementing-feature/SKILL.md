---
name: implementing-feature
description: Implement a feature from a product/tech spec, URL, or GitHub issue. Reads the spec, implements the feature following Streamlit patterns, debugs with hot-reload, and creates a merge-ready PR. Use when given a spec folder path, document URL, or issue link to implement.
---

# Implementing feature

Implement a feature from a specification document, from reading the spec through to a merge-ready PR.

## Usage examples

Use by pointing to a spec folder:
```
/implementing-feature specs/2025-12-12-menu-button
```

Or with a URL to a raw document:
```
/implementing-feature https://raw.githubusercontent.com/streamlit/streamlit/refs/heads/develop/specs/2025-12-12-menu-button/product-spec.md
```

Or with a GitHub issue (feature request as spec):
```
/implementing-feature https://github.com/streamlit/streamlit/issues/12345
```

## When to use

- You have a spec folder, URL, or GitHub issue to implement
- You want end-to-end implementation: spec → code → tests → PR
- You want a guided workflow that ensures all implementation steps are followed

## Workflow

### Phase 1: Read and understand the spec

- If given a folder path (e.g., `specs/YYYY-MM-DD-feature-name`):
  - Read all files in the folder (specs, images, code samples)
- If given a URL to a raw document:
  - Fetch the spec content directly from the URL
- If given a GitHub issue URL:
  - Use the `gh` client to read the issue and all comments
  - Treat the issue description and discussion as the feature specification

### Phase 2: Implement and test

- Search for similar existing features to follow patterns
- Implement the feature based on the provided spec. Read [new-feature-guide](../../../wiki/new-feature-guide.md) for tips.
- Run `make protobuf` after any protobuf changes
- Add unit tests (Python in `lib/tests/`, frontend co-located) and E2E tests in `e2e_playwright/`
- Use the /debugging-streamlit skill to test and debug backend, frontend, and UI

### Phase 3: Verify

- Re-read the spec to verify all requirements are met; document any necessary divergences in `work-tmp/`

### Phase 4: Finalize for merge

- Run /finalizing-pr skill to execute quality checks, create the PR, and make it merge-ready
- Follow all steps until the PR is merge-ready

## Important notes

- **Do not ask for confirmation** - implement directly unless blocked by errors
- **Follow Streamlit patterns** - check existing similar features for conventions
- **Reference the spec in PR** - include spec link in PR description
- **Test thoroughly** - use /debugging-streamlit before finalizing
- **Commit incrementally** - make logical commits as you implement each phase

## References

- [new-feature-guide](../../../wiki/new-feature-guide.md) - Detailed guide for new feature implementation
- [debugging-streamlit](../debugging-streamlit/SKILL.md) - Debug with hot-reload
- [finalizing-pr](../finalizing-pr/SKILL.md) - Make changes merge-ready
- [understanding-streamlit-architecture](../understanding-streamlit-architecture/SKILL.md) - Architecture reference
