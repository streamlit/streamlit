## Review Checklist

- Unit and e2e tests are covering the changes well.
- Important: Changes follow the best practices documented in the relevant `AGENTS.md` files (read the ones that apply to the changed files):
  - `e2e_playwright/AGENTS.md` — for e2e tests (inside `e2e_playwright/`)
  - `frontend/AGENTS.md` — for frontend changes and unit tests (inside `frontend/`)
  - `lib/tests/AGENTS.md` — for Python unit tests (inside `lib/tests/`)
  - `lib/AGENTS.md` — for any Python changes (`*.py` files)
  - `lib/streamlit/AGENTS.md` — for any Python library changes (inside `lib/streamlit/`)
  - `proto/streamlit/proto/AGENTS.md` — for protobuf changes (inside `proto/streamlit/proto/`)
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
5. Run an explicit external-test risk assessment using `/assessing-external-test-risk` and determine whether this branch should include `@pytest.mark.external_test` coverage.
6. Perform a thorough code review based on the checklist above.
7. Write your review following the output format below.

## Output Format

Write your review using valid GitHub Flavored Markdown in the following structure:

```markdown
## Summary

[Brief overview and the main changes introduced.]

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

## Recommendations

[Specific suggestions for improvement, if any. Use a numbered list for actionable items.]

## Verdict

**[APPROVED / CHANGES REQUESTED]**: [One sentence summary of the overall assessment.]

Verdict criteria:
- **APPROVED**: If there are no critical/merge-blocking issues. Minor suggestions or optional improvements should not block approval — those can be addressed in follow-up PRs.
- **CHANGES REQUESTED**: Only use this for merge-blocking issues such as: bugs, security vulnerabilities, breaking changes, missing required tests, or violations of documented patterns. Optional improvements, style preferences, and "nice to have" suggestions should NOT result in CHANGES REQUESTED.

---
*This is an automated AI review. Please verify the feedback and use your judgment.*
```

## Important Notes

- Do NOT run linting, tests, or build commands - focus only on code review.
- Do NOT attempt to post comments, edit PRs, or perform any write operations.
- Focus on the root cause of issues, not cascading failures.
- Be specific with file references and line numbers when noting issues.
- Findings that are covered by inline comments should NOT be repeated in the PR-level review body. The PR-level review covers high-level and cross-cutting concerns only. Inline comments handle line-specific findings.
