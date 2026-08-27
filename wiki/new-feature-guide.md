# New Feature Implementation Guide

For understanding the underlying architecture (backend runtime, frontend rendering, WebSocket communication, element tree), see the [understanding-streamlit-architecture](../.claude/skills/understanding-streamlit-architecture/SKILL.md) skill.

Most features need implementation in three areas:
- Backend: `lib/streamlit/`
- Frontend: `frontend/`
- Protobufs: `proto/`

New features should include:
- Python unit tests in `lib/tests`
- Python typing tests in `lib/tests/streamlit/typing/` for public `st.*` commands
- Vitest unit tests
- E2E Playwright tests in `e2e_playwright/`

## Order of Implementation

1. **Protobuf changes** in `proto/` then run `make protobuf`
   - New elements: add to `proto/streamlit/proto/Element.proto`

2. **Backend** in `lib/streamlit/`
   - New elements: add to `lib/streamlit/__init__.py`
   - Public `st.*` commands: decorate with `gather_metrics`. Use it only for those public APIs, not internal helpers.

3. **Python unit tests** in `lib/tests`
   - Run: `uv run pytest lib/tests/streamlit/the_test_name.py`
   - New elements: add to `lib/tests/streamlit/element_mocks.py`
   - Public `st.*` commands: add or update `lib/tests/streamlit/typing/<command>_types.py` (mypy `assert_type`, not pytest)

4. **Frontend** in `frontend/`
   - New elements: add to `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

5. **Vitest tests** in `*.test.tsx`
   - Run: `cd frontend && yarn test lib/src/components/elements/NewElement/NewElement.test.tsx`

6. **E2E Playwright tests** in `e2e_playwright/`
   - Run: `make run-e2e-test e2e_playwright/name_of_the_test.py`

7. **Autofix** formatting and linting: `make autofix`

8. **Verify** the implementation: `make check`

9. **Bundled agent skills** (user-facing features): update `lib/streamlit/.agents/skills/` following [`lib/streamlit/.agents/skills/AGENTS.md`](../lib/streamlit/.agents/skills/AGENTS.md)
