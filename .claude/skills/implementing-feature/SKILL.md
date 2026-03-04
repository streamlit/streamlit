---
name: implementing-feature
description: Implement a feature from a product/tech spec, URL, or GitHub issue. Reads the spec, implements the feature following Streamlit patterns, debugs with hot-reload, and creates a merge-ready PR. Use when given a spec folder path, document URL, or issue link to implement.
---

# Implementing feature

Implement a feature from a specification document, from reading the spec through to a merge-ready PR.

## Quick start

```
/implementing-feature specs/2025-12-12-menu-button
```

Or with a URL to a raw document:
```
/implementing-feature https://github.com/streamlit/streamlit/blob/develop/specs/2025-12-12-menu-button/product-spec.md
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

1. **Locate and read the spec**
   - If given a folder path (e.g., `specs/YYYY-MM-DD-feature-name`):
     - Read all `.md` files in the folder (`product-spec.md`, `tech-spec.md`, follow-ups)
     - Take a look at any image assets for UI reference
   - If given a URL to a raw document:
     - Fetch the spec content directly from the URL
   - If given a GitHub issue URL:
     - Use the `gh` client to read the issue and all comments
     - Treat the issue description and discussion as the feature specification

2. **Analyze the spec**
   - Identify the feature summary and problem being solved
   - Extract the proposed API/interface
   - Note any constraints, dependencies, or checklist items
   - Identify linked GitHub issues for additional context

### Phase 2: Setup and plan

3. **Create implementation branch**
   - Generate branch name: `feature/{feature-name}-{date}` (e.g., `feature/menu-button-20260304`)
   - Create and checkout the new branch from current HEAD

4. **Research existing patterns**
   - Search for similar existing features to follow patterns
   - Identify files that need to be created or modified:
     - Backend: `lib/streamlit/elements/` or `lib/streamlit/`
     - Frontend: `frontend/lib/src/components/elements/` or `frontend/lib/src/components/widgets/`
     - Protobuf: `proto/streamlit/proto/`
     - Tests: `lib/tests/`, `frontend/`, `e2e_playwright/`

### Phase 3: Implement the feature

5. **Implement backend (if needed)**
   - Add protobuf definitions if needed (run `make protobuf` after changes)
   - Implement the Python API in `lib/streamlit/`
   - Follow existing patterns for similar elements/widgets

6. **Implement frontend (if needed)**
   - Add React component in `frontend/lib/src/components/`
   - Follow existing component patterns

7. **Write tests**
   - Python unit tests in `lib/tests/streamlit/`
   - Frontend unit tests co-located with components
   - E2E tests in `e2e_playwright/`
   - Type tests if adding public API in `lib/tests/streamlit/typing/`

### Phase 4: Debug and verify

8. **Use debugging skill**
   - Run /debugging-streamlit to test the implementation
   - Create a test app in `work-tmp/` demonstrating the feature
   - Verify all spec requirements are met
   - Take screenshots of the working feature

### Phase 5: Finalize for merge

9. **Use finalizing-pr skill**
   - Run /finalizing-pr to:
     - Runs all quality checks (format, lint, type, tests)
     - Simplifies and reviews the code
     - Creates a PR with proper description linking to the spec
     - Addresses any CI failures and review comments

## Important notes

- **Do not ask for confirmation** - implement directly unless blocked by errors
- **Follow Streamlit patterns** - check existing similar features for conventions
- **Reference the spec in PR** - include spec link in PR description
- **Test thoroughly** - use /debugging-streamlit before finalizing
- **Commit incrementally** - make logical commits as you implement each phase

## Related skills

- [implementing-new-features](../implementing-new-features/SKILL.md) - Detailed guide for new feature implementation
- [debugging-streamlit](../debugging-streamlit/SKILL.md) - Debug with hot-reload
- [finalizing-pr](../finalizing-pr/SKILL.md) - Make changes merge-ready
- [understanding-streamlit-architecture](../understanding-streamlit-architecture/SKILL.md) - Architecture reference
