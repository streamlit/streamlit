# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
- `make all` - Install all dependencies, build frontend, and install editable Streamlit
- `make all-dev` - Install all dependencies and editable Streamlit (without building frontend)
- `make frontend-fast` - Build the frontend quickly (for development)
- `make frontend-dev` - Start the frontend development server
- `streamlit run your_app.py` - Run a Streamlit app

### Testing
- `make python-tests` - Run all Python unit tests
- `PYTHONPATH=lib pytest lib/tests/streamlit/specific_test.py` - Run a specific Python test
- `PYTHONPATH=lib pytest lib/tests/streamlit/specific_test.py -k test_name` - Run a specific test function
- `make frontend-tests` - Run all frontend unit tests
- `cd frontend && yarn vitest lib/src/components/elements/Component/Component.test.tsx` - Run specific frontend test
- `make run-e2e-test e2e_playwright/st_element_test.py` - Run a specific e2e test
- `make debug-e2e-test e2e_playwright/st_element_test.py` - Debug a specific e2e test

### Linting and Formatting
- `make python-lint` - Lint and check formatting of Python files
- `make python-format` - Format Python files with Ruff
- `make python-types` - Run Python type checker (ty and mypy)
- `make frontend-lint` - Lint and check formatting of frontend files
- `make frontend-types` - Run frontend type checker
- `make frontend-format` - Format frontend files
- `make autofix` - Auto-fix all linting and formatting errors

### Build System
- `make protobuf` - Recompile Protobufs after modifying .proto files
- `make clean` - Remove all generated files

## High-Level Architecture

### Repository Structure
- **lib/** - Backend Python code
  - **streamlit/** - Main library package
    - **runtime/** - Core runtime handling app sessions, caching, state management
    - **elements/** - UI elements (widgets, charts, containers)
    - **components/** - Custom component system
    - **proto/** - Generated protobuf Python code
- **frontend/** - Frontend TypeScript/React code
  - **app/** - Main Streamlit application UI
  - **lib/** - Shared TypeScript library (elements, widgets, layouts)
  - **connection/** - WebSocket connection handling
  - **protobuf/** - Generated protobuf TypeScript code
- **proto/** - Protobuf definitions for client-server communication
- **e2e_playwright/** - End-to-end tests using Playwright

### Core Architecture Concepts

1. **Client-Server Communication**: Streamlit uses Protocol Buffers (protobuf) for all communication between the Python backend and React frontend via WebSocket connections.

2. **Delta Generator**: The core abstraction for building Streamlit apps. Every Streamlit element (widget, chart, text) is created through the DeltaGenerator which manages the app's element tree and sends updates to the frontend.

3. **Script Runner**: Executes user's Python scripts in a controlled environment, managing reruns, state, and communication with the frontend.

4. **Session Management**: Each browser connection gets its own AppSession with isolated state, managed by the SessionManager.

5. **Widget State**: Bidirectional state synchronization between Python and React components using a unique widget key system.

6. **Caching**: Two main caching decorators (@st.cache_data for data, @st.cache_resource for resources) with configurable storage backends.

7. **Fragment System**: Allows partial reruns of specific code sections for performance optimization.

## Key Development Patterns

### Adding New Elements
1. Define protobuf message in `proto/streamlit/proto/`
2. Run `make protobuf` to generate code
3. Implement Python API in `lib/streamlit/elements/`
4. Add to `lib/streamlit/__init__.py` exports
5. Implement React component in `frontend/lib/src/components/elements/`
6. Register in `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`
7. Write Python unit tests, frontend unit tests, and e2e tests

### Testing Strategy
- **Python Unit Tests**: Test internal behavior without frontend (90%+ coverage target)
- **Frontend Unit Tests**: Test React components with Vitest and React Testing Library
- **E2E Tests**: Test full system integration with Playwright
- **Type Tests**: Verify public API typing with mypy assert_type

### Code Style
- **Python**: Ruff for linting/formatting, mypy and ty for type checking
- **TypeScript**: ESLint for linting, Prettier for formatting
- **Follow existing patterns**: Check neighboring files for conventions
- **No comments unless requested**: Code should be self-documenting

### Important Files
- Widget state synchronization: `lib/streamlit/runtime/state/`
- Script execution: `lib/streamlit/runtime/scriptrunner/`
- Frontend-backend protocol: `proto/streamlit/proto/ForwardMsg.proto` and `BackMsg.proto`
- Component rendering: `frontend/lib/src/components/core/Block/`

## Development Tips

1. After frontend changes, run `make frontend-fast` before testing
2. Use `make autofix` to quickly fix formatting issues
3. Check `lib/tests/streamlit/` and `frontend/lib/src/components/` for examples
4. Protobuf changes must maintain backward compatibility
5. New widgets need proper state management and unique keys
6. Always test in both light and dark themes for UI components
