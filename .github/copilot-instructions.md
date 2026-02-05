# Streamlit Repo Overview

[Streamlit](https://github.com/streamlit/streamlit) is an open-source (Apache 2.0) Python library for creating interactive web applications and dashboards with focus on data apps and internal tools.

## Tech Stack

- **Backend (Server):** Python, Tornado server, pytest
- **Frontend (Web UI):** TypeScript, React, Emotion (CSS-in-JS), Vite, Vitest
- **Communication:** Protocol Buffers (protobuf) over WebSocket.

## Folder Structure

- `lib/`: All backend code and assets.
  - `streamlit/`: The main Streamlit library package.
  - `streamlit/elements/`: Backend code of elements and widgets.
  - `streamlit/runtime/`: App runtime and execution logic.
  - `streamlit/web/`: Web server and CLI implementation
  - `tests`: Python unit tests (pytest).
- `frontend/`: All frontend code and assets.
  - `app/`: Streamlit application UI.
  - `lib/`: Shared TypeScript library that contains elements, widgets, and layouts.
  - `connection/`: WebSocket connection handling logic.
  - `utils/`: Shared utilities.
- `proto/streamlit/proto/`: Protobuf definitions for client-server communication.
- `e2e_playwright/`: E2E tests using playwright (via pytest).
- `scripts/`: Utility scripts for development and CI/CD.
- `component-lib/`: Library for building Streamlit custom components.
- `.github/workflows/`: GitHub Actions workflows used for CI/CD.
- `wiki/`: Documentation relevant for development of Streamlit.

### Shell & Build Policy (AI Agents)

- Prefer `make` targets for all dev tasks (tests, lint, format, builds).
- Always use `uv run` to run any Python command (e.g. `uv run streamlit`, `uv run pytest`, `uv run ruff`, `uv run mypy`, etc.).
- For Python unit tests: `uv run pytest` commands are allowed and encouraged for running specific tests during development.
- For E2E tests: `uv run pytest` commands targeting `e2e_playwright/` files are blocked by policy.
  Use `make run-e2e-test <filename>` instead.

## `make` commands

Selection of `make` commands for development (run in the repo root):

- `help`: Show all available make commands.
- `check`: Run all checks (format, lint, types, unit tests) on changed files only. Useful to verify the current state of the codebase before committing.
- `protobuf`: Recompile Protobufs for Python and the frontend.
- `autofix`: Autofix linting and formatting errors.

**Backend Development (Python):**

- `python-lint`: Lint and check formatting of Python files (ruff).
- `python-tests`: Run all Python unit tests (pytest).
- `python-types`: Run the Python type checker (mypy & ty).
- `python-format`: Format Python files (ruff).

**Frontend Development (TypeScript):**

- `frontend-fast`: Build the frontend (vite).
- `frontend-dev`: Start the frontend development server (hot-reload).
- `frontend-lint`: Lint and check formatting of frontend files (eslint).
- `frontend-types`: Run the TypeScript type checker (tsc).
- `frontend-format`: Format frontend files (eslint).
- `frontend-tests`: Run all frontend unit tests (vitest).

**E2E Testing (Playwright):**

- `run-e2e-test`: Run e2e test, via: `make run-e2e-test st_command_test.py`.

**Debugging (for AI agents):**

- `debug`: Start Streamlit backend and Vite dev server together, via: `make debug my_app.py`.
  - Frontend hot-reload: Changes to frontend code (`frontend/`) are applied within seconds.
  - Backend hot-reload: Only changes to the **app script** trigger a rerun. Changes to the Streamlit library itself (`lib/streamlit/`) require restarting `make debug`.
  - Logs are written to `work-tmp/debug/backend.log` (Python/Streamlit) and `work-tmp/debug/frontend.log` (Vite/browser console).
  - Log files are cleared on each run but persist after exit for post-mortem analysis.
  - Browser `console.log()` output appears in `work-tmp/debug/frontend.log`.
  - See [.claude/skills/debugging-streamlit/SKILL.md](.claude/skills/debugging-streamlit/SKILL.md) for the full debugging guide.

### Development Tips

- **Follow existing patterns**: Check neighboring files for conventions.
- You can use the `work-tmp` directory to store temporary files, specs, and scripts.
- If you fail to run a `make` command, remember to run it from the root / top-level directory.
- Use `make debug <script.py>` to start both backend and frontend with hot-reload for debugging. The app will be available at <http://localhost:3000>.
- Run `make check` after completing changes to run formatting, linting, type checking, and unit tests on all uncommitted files.
- The main branch of this repository is `develop`.

## Testing Strategy

- **Python Unit Tests**: Test internal behavior without frontend.
- **Frontend Unit Tests**: Test React components, hooks, and related functionality with Vitest and React Testing Library.
- **E2E Tests**: Test the entire app logic end-to-end with Playwright.
- **(Python) Type Tests**: Verify public API typing with mypy `assert_type`.
- Prefer running specific tests / test scripts for newly added tests instead the entire test suite.
