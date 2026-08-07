## Review Checklist

- Unit and e2e tests are covering the changes well.
- Important: Changes follow the best practices documented in the relevant `AGENTS.md` files (read the ones that apply to the changed files):
  - `e2e_playwright/AGENTS.md` — for e2e tests (inside `e2e_playwright/`)
  - `frontend/AGENTS.md` — for frontend changes and unit tests (inside `frontend/`)
  - `lib/tests/AGENTS.md` — for Python unit tests (inside `lib/tests/`)
  - `lib/AGENTS.md` — for any Python changes (`*.py` files)
  - `lib/streamlit/AGENTS.md` — for any Python library changes (inside `lib/streamlit/`)
  - `proto/streamlit/proto/AGENTS.md` — for protobuf changes (inside `proto/streamlit/proto/`)
- Product alignment is explicitly assessed for user-facing changes. Treat a change as user-facing
  when it adds or modifies a public API, configuration option, CLI surface, rendered UI or
  interaction, default, error message, or other externally observable behavior.
  - Read `specs/AGENTS.md` and evaluate the change against its "Principles of Streamlit API
    Design."
  - Search `specs/` for a relevant product spec. Product decisions explicitly described in a
    product spec that is already merged into the PR's base branch are considered approved and
    aligned; do not relitigate them. Instead, verify that the implementation follows the spec
    and separately assess any user-facing behavior that the merged spec does not cover. A new
    or modified spec in the current PR is not already approved by this rule.
  - Inspect analogous Streamlit APIs, configs, and behaviors. Check that the proposed surface
    uses established names, defaults, interaction patterns, return types, and error behavior.
  - Confirm that the change solves a clear user problem, keeps the common case simple, exposes
    complexity progressively, composes with existing features, and adds no more permanent
    user-facing surface area than its value justifies.
  - Consider the complete user experience, including discoverability, helpful failures,
    backwards-compatible evolution, and behavior across supported platforms when relevant.
  - If the PR has no user-facing product impact, state that explicitly rather than inventing
    product concerns.
- No risky aspects that could cause security issues or regressions. Pay closer attention to changes in these security-sensitive areas:
  - WebSocket connection handling, server endpoints, authentication, and session management
  - File upload, file/asset serving, and path traversal risks
  - Cookies, XSRF protection, CORS, cross-origin behavior, and security headers (CSP, etc.)
  - New backend or frontend dependencies, or requests to external assets/services
  - Runtime JavaScript execution (e.g., `eval`, `unsafe-eval`, `Function()` constructor)
  - Command/code injection risks (e.g., `subprocess`, `exec`, `eval` in Python)
  - HTML/Markdown rendering and sanitization (XSS risks)
  - iframe embedding and `postMessage` handling
  - Sensitive data handling (secrets, credentials, tokens)
  - `st.login()`/`st.logout()` and OAuth token handling
- External-test risk is explicitly assessed using `/assessing-external-test-risk`, and the review includes a clear `external_test` recommendation.
- Frontend changes follow accessibility best practices.
- The code follows other best practices from the Streamlit code base.

## Instructions

1. **Read the root `AGENTS.md` first** to get an overview of the project.
2. Gather relevant context (branch diff, PR details if available).
3. Read and analyze the changed files to understand the full context.
4. Important: Read the relevant sub-directory `AGENTS.md` files based on changed files (see checklist above).
5. Classify whether the PR has user-facing product impact. If it does, read
   `specs/AGENTS.md`, inspect comparable existing Streamlit surfaces, and perform the product
   alignment assessment from the checklist. If it does not, mark the Product Alignment section as not
   applicable and explain why briefly.
6. Run an explicit external-test risk assessment using `/assessing-external-test-risk` and determine whether this branch should include `@pytest.mark.external_test` coverage.
7. Evaluate readability: run the `/reviewing-readability` skill on the changed code (comments, docstrings, naming) and the `/reviewing-pr-description` skill on the PR title/description if a PR exists, and include their findings and proposed rewrites in your review.
8. Perform a thorough code review based on the checklist above.
9. Write your review following the output format below.

## Output Format

Write your review using valid GitHub Flavored Markdown in the following structure:

```markdown
## Summary

[Brief overview and the main changes introduced.]

## Product Alignment

[State whether the PR has user-facing product impact. If yes, identify any relevant product
spec already merged into the base branch, treat its documented product decisions as approved,
and assess whether the implementation follows it. For user-facing aspects not covered by an
approved spec, assess the user value and complexity tradeoff, consistency with analogous
Streamlit surfaces, and alignment with the principles in `specs/AGENTS.md`. If no, state why
this section is not applicable.]

## Code Quality

[Brief assessment of code structure, patterns, and maintainability. Note any issues with specific file references and line numbers.]

## Test Coverage

[Evaluation of unit and e2e test coverage. Are the changes adequately tested?]

## Backwards Compatibility

[Analysis of any breaking changes. Will this affect existing users?]

## Security & Risk

[Any security concerns or regression risks identified.]

## External test recommendation

[State `external_test` recommendation (Yes/No), triggered categories (or "None"), key evidence from changed files, suggested external test focus areas, and confidence plus assumptions/gaps.]

## Accessibility

[Assessment of accessibility considerations for frontend changes.]

## Readability

[Findings from the `/reviewing-readability` skill (comments, docstrings, naming) and, if a PR exists, the `/reviewing-pr-description` skill (title/description). Group by file; give the location, the issue, and the proposed rewrite.]

## Recommendations

[Specific suggestions for improvement, if any. Use a numbered list for actionable items.]

## Verdict

**[APPROVED / CHANGES REQUESTED]**: [One sentence summary of the overall assessment.]

Verdict criteria:
- **APPROVED**: If there are no critical/merge-blocking issues. Minor suggestions or optional improvements should not block approval — those can be addressed in follow-up PRs.
- **CHANGES REQUESTED**: Only use this for merge-blocking issues such as: bugs, security vulnerabilities, breaking changes, missing required tests, or clear material violations of documented Streamlit product/API principles and patterns. Optional improvements, style preferences, and "nice to have" suggestions should NOT result in CHANGES REQUESTED.

---
*This is an automated AI review. Please verify the feedback and use your judgment.*
```

## Important Notes

- Do NOT run linting, tests, or build commands - focus only on code review.
- Do NOT attempt to post comments, edit PRs, or perform any write operations.
- Focus on the root cause of issues, not cascading failures.
- Be specific with file references and line numbers when noting issues.
- Product feedback must cite concrete changed behavior and the relevant documented principle or
  established Streamlit pattern. Product questions and optional refinements are non-blocking;
  request changes only when the mismatch would create material user harm or lasting,
  unjustified complexity in the public surface.
- Findings that are covered by inline comments should NOT be repeated in the PR-level review body. The PR-level review covers high-level and cross-cutting concerns only. Inline comments handle line-specific findings.
