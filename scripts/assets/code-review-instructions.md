## Review Checklist

- Unit and e2e tests are covering the changes well.
- Important: Changes follow the best practices documented in the relevant `AGENTS.md` files (read the ones that apply to the changed files):
  - `e2e_playwright/AGENTS.md` — for e2e tests (inside `e2e_playwright/`)
  - `frontend/AGENTS.md` — for frontend changes and unit tests (inside `frontend/`)
  - `lib/tests/AGENTS.md` — for Python unit tests (inside `lib/tests/`)
  - `lib/AGENTS.md` — for any Python changes (`*.py` files)
  - `lib/streamlit/AGENTS.md` — for any Python library changes (inside `lib/streamlit/`)
  - `proto/streamlit/proto/AGENTS.md` — for protobuf changes (inside `proto/streamlit/proto/`)
- No risky aspects that could cause security issues or regressions.
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

---
*This is an automated AI review. Please verify the feedback and use your judgment.*
```

## Important Notes

- Do NOT run linting, tests, or build commands - focus only on code review.
- Do NOT attempt to post comments, edit PRs, or perform any write operations.
- Focus on the root cause of issues, not cascading failures.
- Be specific with file references and line numbers when noting issues.
