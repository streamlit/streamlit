---
name: implementing-feature
description: Implement a feature from a product/tech spec, URL, or GitHub issue. Reads the spec, implements the feature following Streamlit patterns, and creates a merge-ready PR. Use when given a spec folder path, document URL, or issue link to implement.
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

Copy this checklist and track your progress:

```
Progress:
- [ ] Phase 1: Read and understand the spec
- [ ] Phase 2: Research and plan
- [ ] Phase 3: Implement and test
- [ ] Phase 4: Verify against spec
- [ ] Phase 5: Finalize for merge
```

### Phase 1: Read and understand the spec

- If given a folder path (e.g., `specs/YYYY-MM-DD-feature-name`):
  - Read all files in the folder (specs, images, code samples)
- If given a URL to a raw document:
  - Fetch the spec content directly from the URL
- If given a GitHub issue URL:
  - Use the `gh` client to read the issue and all comments
  - Treat the issue description and discussion as the feature specification

### Phase 2: Research and plan

Run this phase in a **foreground subagent**. The subagent should:

- Search for similar existing features to follow patterns
- Use the `/understanding-streamlit-architecture` skill to understand relevant internals
- **Always write an implementation plan** to `work-tmp/<feature-name>-implementation-plan.md`, where `<feature-name>` is derived from the branch name (e.g., `git branch --show-current | sed 's|.*/||'`) or, if on a detached HEAD, the spec folder basename

The implementation plan must include:
- Summary of the feature requirements (from spec)
- Relevant existing patterns found in codebase
- List of files to create or modify (backend, frontend, proto, tests)
- Implementation steps in order
- Key decisions and trade-offs
- Test strategy (unit tests, E2E tests)

Wait for the subagent to complete and verify the implementation plan exists before proceeding.

### Phase 3: Implement and test

Run this phase in a **foreground subagent**. Provide all relevant context needed to implement the feature, including the full spec content, the implementation plan from Phase 2, and any key API signatures or patterns identified during research.

The subagent should:
- Implement the feature based on the spec and plan. Read `wiki/new-feature-guide.md` for tips.
- Do additional research if anything is unclear or missing from the provided context
- Run `make protobuf` after any protobuf changes
- Add unit tests (Python in `lib/tests/`, frontend co-located) and E2E tests in `e2e_playwright/`
- Use the `/debugging-streamlit` skill to test and debug backend, frontend, and UI
- Return a summary of key implementation decisions and any spec divergences

### Phase 4: Verify against spec

- Re-read the spec to verify all requirements are met; document any necessary divergences in `work-tmp/`
- Run the `/qa-testing-feature` subagent to perform comprehensive QA testing of the implementation. Provide:
  - A brief description of the feature being tested
  - Paths to relevant documents (spec, implementation plan, API files with docstrings)
- Review the QA report and address any issues found before proceeding

### Phase 5: Finalize for merge

- Run `/finalizing-pr` skill to execute quality checks, create the PR, and make it merge-ready
- Follow all steps until the PR is merge-ready

## Important notes

- **Be fully autonomous** - Do NOT stop or pause to ask for confirmation. You are tasked to go from spec to merge-ready PR without human intervention. Note any open questions or ambiguities in the PR description rather than blocking on them.
- **Use foreground subagents** - Phases 2 and 3 run as foreground (blocking) subagents to preserve main context while delegating intensive research and implementation work.
- **Follow Streamlit patterns** - Check existing similar features for conventions
- **Reference the spec in PR** - Include spec link in PR description
- **Test thoroughly** - Use `/debugging-streamlit` before finalizing
