---
name: discovering-make-commands
description: Lists available make commands for Streamlit development. Use for build, test, lint, or format tasks.
---

# Available `make` commands

List of all `make` commands available for execution from the repository root folder:

```
help                      Show all available make commands.
all                       Install all dependencies, build frontend, and install editable Streamlit.
all-dev                   Install all dependencies and editable Streamlit, but do not build the frontend.
init                      Install all dependencies and build protobufs.
clean                     Remove all generated files.
protobuf                  Recompile Protobufs for Python and the frontend.
protobuf-lint             Lint and check formatting of protobuf files (buf).
protobuf-format           Format protobuf files (buf).
python-init               Install Python dependencies and Streamlit in editable mode.
python-lint               Lint and check formatting of Python files.
python-format             Format Python files.
python-tests              Run Python unit tests.
python-performance-tests  Run Python performance tests.
python-integration-tests  Run Python integration tests. Requires `uv sync --group integration` to be run first.
python-types              Run the Python type checker.
frontend-init             Install all frontend dependencies.
frontend                  Build the frontend.
frontend-with-profiler    Build the frontend with the profiler enabled.
frontend-fast             Build the frontend (as fast as possible).
frontend-dev              Start the frontend development server.
debug                     Start Streamlit and Vite dev server for debugging. Use via `make debug my-script.py`.
frontend-lint             Lint and check formatting of frontend files.
frontend-types            Run the frontend type checker.
frontend-format           Format frontend files.
frontend-tests            Run frontend unit tests and generate coverage report.
frontend-typesync         Check for unsynced frontend types.
update-frontend-typesync  Installs missing typescript typings for dependencies.
update-snapshots          Update e2e playwright snapshots based on the latest completed CI run.
update-snapshots-changed  Update e2e playwright snapshots of changed e2e files based on the latest completed CI run.
update-material-icons     Update material icons based on latest Google material symbol version.
update-emojis             Update emojis based on latest emoji version.
update-notices            Update the notices file (licenses of frontend assets and dependencies).
update-headers            Update all license headers.
update-min-deps           Update minimum dependency constraints file.
debug-e2e-test            Run a playwright e2e test in debug mode. Use it via `make debug-e2e-test st_command_test.py`.
run-e2e-test              Run a playwright e2e test. Use it via `make run-e2e-test st_command_test.py`.
trace-e2e-test            Run e2e test with tracing and view it. Use via `make trace-e2e-test <test_file.py>::<test_func>`.
lighthouse-tests          Run Lighthouse performance tests.
bare-execution-tests      Run all e2e tests in bare mode.
cli-smoke-tests           Run CLI smoke tests.
check                     Run all checks (format, lint, types, unit tests) on changed files only. Useful to verify the current state of the codebase before committing.
autofix                   Autofix linting and formatting errors.
package                   Create Python wheel files in `dist/`.
```
