---
name: implementing-feature
description: Implement a feature from a product/tech spec, URL, GitHub issue, or by auto-selecting the next papercut enhancement. Reads the spec, implements the feature following Streamlit patterns, and creates a merge-ready PR. Use when given a spec folder path, document URL, or issue link to implement, or when asked to implement a feature or papercut without a spec.
---

# Implementing feature

Implement a feature from a spec, GitHub issue, or auto-selected papercut, through to a merge-ready PR.

## Usage examples

Use by pointing to a spec folder:
```
/implementing-feature specs/2025-12-12-menu-button
```

Or with a URL to a raw document:
```
/implementing-feature https://raw.githubusercontent.com/streamlit/streamlit/refs/heads/develop/specs/2025-12-12-menu-button/product-spec.md
```

Or with a GitHub issue (feature request as spec; `#` optional):
```
/implementing-feature https://github.com/streamlit/streamlit/issues/12345
/implementing-feature 12345
/implementing-feature #12345
```

With no argument, auto-select the next papercut enhancement:
```
/implementing-feature
```

## When to use

- You have a spec folder, URL, or GitHub issue to implement
- You want the next papercut enhancement selected automatically
- You want end-to-end implementation: spec → code → tests → PR
- You want a guided workflow that ensures all implementation steps are followed

## Workflow

Copy this checklist and track your progress:

```
Progress:
- [ ] Phase 0: Select the feature
- [ ] Phase 1: Read and understand the spec
- [ ] Phase 2: Research and plan
- [ ] Phase 3: Implement and test
- [ ] Phase 4: Verify against spec
- [ ] Phase 5: Finalize for merge
```

### Phase 0: Select the feature

Parse the argument as a spec folder path, raw document URL, GitHub issue URL, or numeric ID (strip a leading `#`). If none is given, auto-select.

#### Auto-select (no spec or issue given)

Papercuts are small enhancements that do not need a product spec or decision. List candidates, skip claimed or already-targeted issues, then take the first remaining:

```bash
gh issue list --repo streamlit/streamlit --search "is:issue state:open label:papercut label:type:enhancement -label:upstream sort:reactions-+1-desc no:assignee" --limit 200 --json number,title,url
```

Keep a skip list of issue IDs rejected in this run. Walk the full result list in order (already sorted by +1 reactions descending); raise `--limit` or paginate if you exhaust a page without an eligible issue. Do not start a new search after a rejection.

1. Skip IDs already on the skip list.
2. Re-fetch assignees immediately before claiming. `--add-assignee` only adds the current user; it does not fail or lock the issue if someone else is already assigned.

   ```bash
   ME=$(gh api user --jq .login)
   gh api repos/streamlit/streamlit/issues/<id> --jq '{state, assignees: [.assignees[].login]}'
   ```

   Skip if the issue is closed, or if any assignee is not `$ME`.
3. Skip when an open PR already targets it:

   ```bash
   gh pr list --repo streamlit/streamlit --search "Closes #<id> OR Fixes #<id> OR Resolves #<id>" --state open --limit 50 --json number,title,url,body
   ```

   Skip if an open PR already uses a closing keyword for this issue (`Closes #<id>`, `Fixes #<id>`, `Resolves #<id>`, and GitHub's close/fix/resolve variants).
4. Select the first remaining issue. If none remain, stop and report that.
5. Treat the issue body and comments as the feature specification.

#### Assign issues

Always assign every GitHub issue this implementation will resolve to the current user — the selected papercut, a user-specified issue, and any issues the spec says this work closes. Do this as soon as each issue is known, before research.

```bash
gh issue edit <id> --add-assignee @me
```

For auto-select, claim only after the Phase 0 skip checks pass. For a user-specified spec or issue, add `@me` even when someone else is assigned, and implement it anyway.

### Phase 1: Read and understand the spec

- If given a folder path (e.g., `specs/YYYY-MM-DD-feature-name`):
  - Read all files in the folder (specs, images, code samples)
- If given a URL to a raw document:
  - Fetch the spec content directly from the URL
- If given a GitHub issue URL or ID, or after auto-select:
  - Use the `gh` client to read the issue and all comments
  - Treat the issue description and discussion as the feature specification
- If the spec names additional GitHub issues this work will close, assign those too (see Phase 0)

If an auto-selected papercut is already implemented on `develop`, needs a product spec or decision, or is not feasible, do not implement it. Add its ID to this run's skip list, unassign `@me` if this run assigned it, and continue with the next candidate from the original results. For a user-specified issue with the same outcome, comment on the issue with the conclusion, unassign `@me` if this run assigned it, and stop.

### Phase 2: Research and plan

Run this phase in a **foreground subagent**. The subagent should:

- Search for similar existing features to follow patterns
- Use the `/understanding-streamlit-architecture` skill to understand relevant internals
- **Always write an implementation plan** to `work-tmp/<feature-name>-implementation-plan.md`, where `<feature-name>` is derived from the branch name (e.g., `git branch --show-current | sed 's|.*/||'`) or, if on a detached HEAD, the spec folder basename or `feature-<issue-id>`

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
- Add the appropriate `change:` label (usually `change:feature`) plus `impact:users`, and include `- Closes #<id>` in the PR description for every issue this work resolves
- Follow all steps until the PR is merge-ready

## Important notes

- **Be fully autonomous** - Do NOT stop or pause to ask for confirmation. You are tasked to go from spec to merge-ready PR without human intervention. Note any open questions or ambiguities in the PR description rather than blocking on them.
- **Use foreground subagents** - Phases 2 and 3 run as foreground (blocking) subagents to preserve main context while delegating intensive research and implementation work.
- **Claim before researching** - Assign `@me` on every issue this work will close as soon as it is known.
- **Follow Streamlit patterns** - Check existing similar features for conventions
- **Reference the spec in PR** - Include spec link in PR description
- **Test thoroughly** - Use `/debugging-streamlit` before finalizing
