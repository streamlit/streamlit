# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents

- [Order of implementation](#order-of-implementation)
- [Folder Structure](#folder-structure)
- [`make` commands](#make-commands)



# Available `make` commands

List of all `make` commands that are available for execution from the repository root folder:

help                       Show all available make commands.
all                        Install all dependencies, build frontend, and install editable Streamlit.
all-dev                    Install all dependencies and editable Streamlit, but do not build the frontend.
init                       Install all dependencies and build protobufs.
clean                      Remove all generated files.
protobuf                   Recompile Protobufs for Python and the frontend.
python-init                Install Python dependencies and Streamlit in editable mode.
python-lint                Lint and check formatting of Python files.
python-format              Format Python files.
python-tests               Run Python unit tests.
python-performance-tests   Run Python performance tests.
python-integration-tests   Run Python integration tests. Requires `integration-requirements.txt` to be installed.
python-types               Run the Python type checker.
frontend-init              Install all frontend dependencies.
frontend                   Build the frontend.
frontend-with-profiler     Build the frontend with the profiler enabled.
frontend-fast              Build the frontend (as fast as possible).
frontend-dev               Start the frontend development server.
frontend-lint              Lint and check formatting of frontend files.
frontend-types             Run the frontend type checker.
frontend-format            Format frontend files.
frontend-tests             Run frontend unit tests and generate coverage report.
frontend-typesync          Check for unsynced frontend types.
update-frontend-typesync   Installs missing typescript typings for dependencies.
update-snapshots           Update e2e playwright snapshots based on the latest completed CI run.
update-snapshots-changed   Update e2e playwright snapshots of changed e2e files based on the latest completed CI run.
update-material-icons      Update material icons based on latest Google material symbol version.
update-notices             Update the notices file (licenses of frontend assets and dependencies).
update-headers             Update all license headers.
update-min-deps            Update minimum dependency constraints file.
debug-e2e-test             Run a playwright e2e test in debug mode. Use it via `make debug-e2e-test st_command_test.py`.
run-e2e-test               Run a playwright e2e test. Use it via `make run-e2e-test st_command_test.py`.
lighthouse-tests           Run Lighthouse performance tests.
bare-execution-tests       Run all e2e tests in bare mode.
cli-smoke-tests            Run CLI smoke tests.
autofix                    Autofix linting and formatting errors.
package                    Create Python wheel files in `dist/`.
conda-package              Create conda distribution files.

---


# New Feature - Implementation Guide

- Most features need to be implemented in the backend in `lib/streamlit/`, the frontend `frontend/` and will need changes to our protobuf definitions in `proto/`.
- New features should be covered by Python Unit Tests in `lib/tests`, Vitest Unit Tests, and e2e playwright tests in `e2e_playwright/`.
- Implementing new element commands requires additional steps to correctly register the element (see notes below).

## Order of implementation

1. implement protobuf changes in `proto/` & run: `make protobuf` (-> @protobuf.mdc)
   - Note: new elements need to be added to `proto/streamlit/proto/Element.proto`.
2. implement backend implementation in `lib/streamlit/` (-> @python_lib.mdc)
   - Note: new elements need to be added to `lib/streamlit/__init__.py`
3. implement Python unit tests in `lib/tests` & run via: `PYTHONPATH=lib pytest lib/tests/streamlit/the_test_name.py` (-> @python_tests.mdc)
   - Note: new elements need to be added to `lib/tests/streamlit/element_mocks.py`
4. implement frontend changes in `frontend/` (-> @typescript.mdc)
   - Note: new elements need to be added to `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`
5. implement vitest unit tests in `*.test.tsx` & run via: `cd frontend && yarn vitest lib/src/components/elements/NewElement/NewElement.test.tsx` (-> @typescript_tests.mdc)
6. implement e2e playwright test in `e2e_playwright/` & run via: `make run-e2e-test e2e_playwright/name_of_the_test.py` (-> @e2e_playwright.mdc)
7. run `make autofix` to auto-fix linting and formatting issues.

---


# Streamlit Repo Overview

## Folder Structure

- `lib/`: All backend code and assets.
- `lib/streamlit/`: The main Streamlit library package.
- `lib/streamlit/elements/`: Backend code of elements and widgets.
- `lib/tests`: Python unit tests.
- `frontend/`: All frontend code and assets.
- `frontend/app/`: Streamlit application UI.
- `frontend/lib/`: Shared TS library that contains elements, widgets, and layouts.
- `frontend/utils/`: Shared utils.
- `frontend/connection/`: WebSocket connection handling logic.
- `proto/`: Protobuf definitions for client-server communication.
- `e2e_playwright/`: E2E tests using playwright.
- `scripts/`: Utility scripts for development and CI/CD.
- `component-lib/`: Library for building custom components.

## `make` commands

Selection of `make` commands executable from root relevant for development:

help                       Show all available commands.
protobuf                   Recompile Protobufs for Python and the frontend.
python-lint                Lint and check formatting of Python files.
python-tests               Run all Python unit tests.
python-types               Run the Python type checker.
frontend-fast              Build the frontend.
frontend-dev               Start the frontend development server.
frontend-lint              Lint and check formatting of frontend files.
frontend-types             Run the frontend type checker.
frontend-format            Format frontend files.
frontend-tests             Run all frontend unit tests.
autofix                    Autofix linting and formatting errors.
debug-e2e-test             Run e2e test in debug mode, via: `make debug-e2e-test st_command_test.py`.
run-e2e-test               Run e2e test, via: `make run-e2e-test st_command_test.py`.
