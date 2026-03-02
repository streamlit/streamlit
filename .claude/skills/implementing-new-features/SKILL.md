---
name: implementing-new-features
description: Implementation guide for new Streamlit features. Use when adding new elements, widgets, or features that span backend, frontend, and protobufs.
---

# New Feature Implementation Guide

Most features need implementation in three areas:
- Backend: `lib/streamlit/`
- Frontend: `frontend/`
- Protobufs: `proto/`

New features should include:
- Python unit tests in `lib/tests`
- Vitest unit tests
- E2E Playwright tests in `e2e_playwright/`

## Order of Implementation

1. **Protobuf changes** in `proto/` then run `make protobuf`
   - New elements: add to `proto/streamlit/proto/Element.proto`

2. **Backend** in `lib/streamlit/`
   - New elements: add to `lib/streamlit/__init__.py`

3. **Python unit tests** in `lib/tests`
   - Run: `uv run pytest lib/tests/streamlit/the_test_name.py`
   - New elements: add to `lib/tests/streamlit/element_mocks.py`

4. **Frontend** in `frontend/`
   - New elements: add to `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

5. **Vitest tests** in `*.test.tsx`
   - Run: `cd frontend && yarn vitest lib/src/components/elements/NewElement/NewElement.test.tsx`

6. **E2E Playwright tests** in `e2e_playwright/`
   - Run: `make run-e2e-test e2e_playwright/name_of_the_test.py`

7. **Autofix** formatting and linting: `make autofix`

8. **Verify** the implementation: `make check`
