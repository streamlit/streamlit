# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Make uses /bin/sh by default, but we are using some bash features. On Ubuntu
# /bin/sh is POSIX compliant, ie it's not bash.  So let's be explicit:
SHELL=/bin/bash

INSTALL_DEV_REQS ?= true
INSTALL_TEST_REQS ?= true
INSTALL_PLAYWRIGHT ?= true
# Flags:
#  - INSTALL_DEV_REQS: install dev requirements (default: true)
#  - INSTALL_TEST_REQS: install test requirements (default: true)
#  - INSTALL_PLAYWRIGHT: install Playwright browsers during python-init (default: true)
#    CI uses a dedicated action to install browsers and typically sets this to false.
#    Local dev can opt out when not needed: `INSTALL_PLAYWRIGHT=false make init`
PYTHON_VERSION := $(shell python --version | cut -d " " -f 2 | cut -d "." -f 1-2)
MIN_PROTOC_VERSION = 3.20

# Check if Python is installed and can be executed, otherwise show an error message in red (but continue)
ifeq ($(PYTHON_VERSION),)
error_message="Error: Python version is not detected. Please ensure Python is installed and accessible in your PATH."
error_message_red_colored=$(shell echo -e "\033[0;31m ${error_message} \033[0m")
$(warning ${error_message_red_colored})
endif

.PHONY: help
# Show all available make commands.
help:
	@# Magic line used to create self-documenting makefiles.
	@# Note that this means the documenting comment just before the command (but after the .PHONY) must be all one line, and should begin with a capital letter and end with a period.
	@# See https://stackoverflow.com/a/35730928
	@awk '/^#/{c=substr($$0,3);next}c&&/^[[:alpha:]][[:alnum:]_-]+:/{print substr($$1,1,index($$1,":")-1) ";" c}1{c=0}' Makefile | column -s';' -t

.PHONY: all
# Install all dependencies, build frontend, and install editable Streamlit.
all: init frontend

.PHONY: all-dev
# Install all dependencies and editable Streamlit, but do not build the frontend.
all-dev: init
	uv run pre-commit install
	@echo ""
	@echo "    The frontend has *not* been rebuilt."
	@echo "    If you need to make a wheel file, run:"
	@echo ""
	@echo "    make frontend"
	@echo ""

.PHONY: init
# Install all dependencies and build protobufs.
init: python-init frontend-init protobuf


.PHONY: clean
# Remove all generated files.
clean:
	cd lib; rm -rf build dist  .eggs *.egg-info
	find . -name '*.pyc' -type f -delete || true
	find . -name __pycache__ -type d -delete || true
	find . -name .pytest_cache -exec rm -rfv {} \; || true
	find . -name '.benchmarks' -type d -exec rm -rfv {} \; || true
	rm -rf .mypy_cache
	rm -rf .ruff_cache
	rm -f lib/streamlit/proto/*_pb2.py*
	rm -rf lib/streamlit/static
	rm -f lib/Pipfile.lock
	rm -rf frontend/app/build
	find . -name node_modules -type d -prune -exec rm -rf {} \; || true
	rm -rf frontend/app/performance/lighthouse/reports
	rm -rf frontend/test_results
	rm -f frontend/protobuf/proto.js
	rm -f frontend/protobuf/proto.d.ts
	rm -rf frontend/public/reports
	rm -rf frontend/lib/dist
	rm -rf frontend/connection/dist
	rm -rf frontend/component-v2-lib/dist
	rm -rf ~/.cache/pre-commit
	rm -rf e2e_playwright/test-results
	rm -rf e2e_playwright/performance-results
	find . -name .streamlit -not \( -path './e2e_playwright/.streamlit' -o -path './e2e_playwright/config/.streamlit' \) -type d -exec rm -rfv {} \; || true
	cd lib; rm -rf .coverage .coverage\.*

.PHONY: protobuf
# Recompile Protobufs for Python and the frontend.
protobuf:
  # Ensure protoc is installed and is >= MIN_PROTOC_VERSION.
	@if ! command -v protoc &> /dev/null ; then \
		echo "protoc not installed."; \
		exit 1; \
	fi; \
	\
	PROTOC_VERSION=$$(protoc --version | cut -d ' ' -f 2); \
	\
	if [[ $$(echo -e "$$PROTOC_VERSION\n$(MIN_PROTOC_VERSION)" | sort -V | head -n1) != $(MIN_PROTOC_VERSION) ]]; then \
		echo "Error: protoc version $${PROTOC_VERSION} is < $(MIN_PROTOC_VERSION)"; \
		exit 1; \
	else \
		echo "protoc version $${PROTOC_VERSION} is >= than $(MIN_PROTOC_VERSION)"; \
	fi; \
	uv run protoc \
		--proto_path=proto \
		--python_out=lib \
		--mypy_out=lib \
		proto/streamlit/proto/*.proto

	@# JS/TS protobuf generation
	cd frontend/ ; yarn workspace @streamlit/protobuf run generate-protobuf

.PHONY: protobuf-lint
# Lint and check formatting of protobuf files (buf).
protobuf-lint:
	cd frontend && yarn buf format ../proto --diff --exit-code
	cd frontend && yarn buf lint ../proto

.PHONY: protobuf-format
# Format protobuf files (buf).
protobuf-format:
	cd frontend && yarn buf format ../proto -w

.PHONY: python-init
# Install Python dependencies and Streamlit in editable mode.
python-init:
	@# Check if uv is installed
	@if ! command -v uv > /dev/null 2>&1; then \
		echo "Installing uv..."; \
		pip install uv; \
	fi
	@# Determine which dependency group to sync
	@if [ "${INSTALL_DEV_REQS}" = "true" ] && [ "${INSTALL_TEST_REQS}" = "true" ]; then \
		echo "Installing dev dependencies (includes test)..."; \
		uv sync --group dev; \
	elif [ "${INSTALL_DEV_REQS}" = "true" ]; then \
		echo "Installing dev dependencies..."; \
		uv sync --group dev; \
	elif [ "${INSTALL_TEST_REQS}" = "true" ]; then \
		echo "Installing test dependencies..."; \
		uv sync --group test; \
	else \
		echo "Installing base dependencies..."; \
		uv sync; \
	fi
	@# Install playwright if requested
	@if [ "${INSTALL_TEST_REQS}" = "true" ] && [ "${INSTALL_PLAYWRIGHT}" = "true" ]; then \
		uv run python -m playwright install --with-deps; \
	fi

.PHONY: python-lint
# Lint and check formatting of Python files.
python-lint:
	# Checks if the formatting is correct:
	uv run ruff format --check
	# Run linter:
	uv run ruff check

.PHONY: python-format
# Format Python files.
python-format:
	# Sort imports ( see https://docs.astral.sh/ruff/formatter/#sorting-imports )
	uv run ruff check --select I --fix
	# Run code formatter
	uv run ruff format

.PHONY: python-tests
# Run Python unit tests.
python-tests:
	uv run pytest -c lib/pyproject.toml -v -l \
		-m "not performance" \
		lib/tests/

.PHONY: python-performance-tests
# Run Python performance tests.
python-performance-tests:
	uv run pytest -c lib/pyproject.toml -v -l \
		-m "performance" \
		--benchmark-autosave \
		--benchmark-storage file://.benchmarks/pytest \
		lib/tests/

.PHONY: python-integration-tests
# Run Python integration tests. Requires `uv sync --group integration` to be run first.
python-integration-tests:
	uv run pytest -c lib/pyproject.toml -v -l \
		--require-integration \
		lib/tests/

.PHONY: python-types
# Run the Python type checker.
python-types:
	# Run ty type checker:
	uv run ty check
	# Run mypy type checker (reads config from pyproject.toml):
	uv run mypy


.PHONY: frontend-init
# Install all frontend dependencies.
frontend-init:
	@cd frontend/ && { \
		corepack enable yarn; \
		if [ $$? -ne 0 ]; then \
			echo "Error: 'corepack' command not found or failed to enable."; \
			echo "Please ensure you are running the expected version of Node.js as defined in '.nvmrc'."; \
			exit 1; \
		fi; \
		corepack install && yarn install --immutable; \
	}

.PHONY: frontend
# Build the frontend.
frontend:
	cd frontend/ ; yarn workspaces foreach --all --topological --parallel run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/
	# Move manifest.json to a location that can actually be served by the Tornado
	# server's static asset handler.
	mv lib/streamlit/static/.vite/manifest.json lib/streamlit/static

.PHONY: frontend-with-profiler
# Build the frontend with the profiler enabled.
frontend-with-profiler:
	# Build frontend dependent libraries (excluding app and lib):
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/app --exclude @streamlit/lib --topological --parallel run build
	# Build the app with the profiler enabled:
	cd frontend/ ; yarn workspace @streamlit/app buildWithProfiler
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-fast
# Build the frontend (as fast as possible).
frontend-fast:
	cd frontend/ ; yarn workspaces foreach --recursive --topological --parallel --from @streamlit/app --exclude @streamlit/lib run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-dev
# Start the frontend development server.
frontend-dev:
	cd frontend/ ; yarn start

.PHONY: debug
# Start Streamlit and Vite dev server for debugging. Use via `make debug my-script.py`.
debug:
	@SCRIPT=$$(echo $(filter-out $@,$(MAKECMDGOALS))); \
	if [[ -z "$$SCRIPT" ]]; then \
		echo "Error: Please specify a Streamlit script"; \
		echo "Usage: make debug <script.py>"; \
		exit 1; \
	fi; \
	if [[ ! -f "$$SCRIPT" ]]; then \
		echo "Error: Script '$$SCRIPT' not found"; \
		exit 1; \
	fi; \
	PORT_3000_PID=$$(lsof -ti:3000 2>/dev/null | tr '\n' ' '); \
	PORT_8501_PID=$$(lsof -ti:8501 2>/dev/null | tr '\n' ' '); \
	if [[ -n "$$PORT_3000_PID" ]] || [[ -n "$$PORT_8501_PID" ]]; then \
		echo "Error: Required ports are already in use."; \
		if [[ -n "$$PORT_3000_PID" ]]; then \
			echo "  Port 3000 (Vite): PID(s) $$PORT_3000_PID"; \
		fi; \
		if [[ -n "$$PORT_8501_PID" ]]; then \
			echo "  Port 8501 (Streamlit): PID(s) $$PORT_8501_PID"; \
		fi; \
		echo ""; \
		echo "Please stop these processes and try again."; \
		echo "To kill them: kill $$PORT_3000_PID$$PORT_8501_PID"; \
		exit 1; \
	fi; \
	DEBUG_DIR="$$(pwd)/work-tmp/debug"; \
	mkdir -p "$$DEBUG_DIR"; \
	> "$$DEBUG_DIR/backend.log"; \
	> "$$DEBUG_DIR/frontend.log"; \
	cleanup() { \
		echo ""; \
		echo "Stopping servers... logs saved to work-tmp/debug/"; \
		lsof -ti:3000 | xargs kill 2>/dev/null || true; \
		lsof -ti:8501 | xargs kill 2>/dev/null || true; \
	}; \
	trap cleanup EXIT; \
	uv run streamlit run "$$SCRIPT" \
		--server.headless=true \
		--server.runOnSave=true \
		--browser.gatherUsageStats=false \
		--global.developmentMode=true \
		>> "$$DEBUG_DIR/backend.log" 2>&1 & \
	cd frontend && DEBUG_TO_CONSOLE=1 yarn start >> "$$DEBUG_DIR/frontend.log" 2>&1 & \
	echo ""; \
	echo "Starting debug session: $$SCRIPT"; \
	BACKEND_READY=false; \
	FRONTEND_READY=false; \
	for i in $$(seq 1 60); do \
		if [[ "$$BACKEND_READY" == "false" ]] && curl -s http://localhost:8501/_stcore/health > /dev/null 2>&1; then \
			BACKEND_READY=true; \
		fi; \
		if [[ "$$FRONTEND_READY" == "false" ]] && curl -s http://localhost:3000 > /dev/null 2>&1; then \
			FRONTEND_READY=true; \
		fi; \
		if [[ "$$BACKEND_READY" == "true" ]] && [[ "$$FRONTEND_READY" == "true" ]]; then \
			break; \
		fi; \
		sleep 1; \
	done; \
	echo ""; \
	if [[ "$$BACKEND_READY" == "false" ]] || [[ "$$FRONTEND_READY" == "false" ]]; then \
		echo "Warning: Servers may not have started correctly. Check log files."; \
		echo ""; \
	fi; \
	echo "  App URL: http://localhost:3000"; \
	echo ""; \
	echo "  Log files:"; \
	echo "    work-tmp/debug/backend.log  - Streamlit/Python output"; \
	echo "    work-tmp/debug/frontend.log - Vite/browser console output"; \
	echo ""; \
	echo "Press Ctrl+C to stop."; \
	echo ""; \
	wait

.PHONY: frontend-lint
# Lint and check formatting of frontend files.
frontend-lint:
	cd frontend/ ; yarn workspaces foreach --all --parallel run formatCheck
	cd frontend/ ; yarn lint

.PHONY: frontend-types
# Run the frontend type checker.
frontend-types:
	cd frontend/ ; yarn workspaces foreach --all --parallel run typecheck

.PHONY: frontend-format
# Format frontend files.
frontend-format:
	cd frontend/ ; yarn workspaces foreach --all --parallel run format

.PHONY: frontend-tests
# Run frontend unit tests and generate coverage report.
frontend-tests:
	cd frontend; TESTPATH=$(TESTPATH) yarn testCoverage

.PHONY: frontend-typesync
# Check for unsynced frontend types.
frontend-typesync:
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/typescript-config run typesync:ci --dry=fail || (\
		echo -e "\033[0;31mTypesync check failed. Run 'make update-frontend-typesync' to fix.\033[0m"; \
		exit 1 \
	)

.PHONY: update-frontend-typesync
# Installs missing typescript typings for dependencies.
update-frontend-typesync:
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/typescript-config run typesync
	cd frontend/ ; yarn
	cd component-lib/ ; yarn typesync
	cd component-lib/ ; yarn

.PHONY: update-snapshots
# Update e2e playwright snapshots based on the latest completed CI run.
update-snapshots:
	uv run python ./scripts/update_e2e_snapshots.py

.PHONY: update-snapshots-changed
# Update e2e playwright snapshots of changed e2e files based on the latest completed CI run.
update-snapshots-changed:
	uv run python ./scripts/update_e2e_snapshots.py --changed

.PHONY: update-material-icons
# Update material icons based on latest Google material symbol version.
update-material-icons:
	uv run python ./scripts/update_material_icon_font_and_names.py

.PHONY: update-emojis
# Update emojis based on latest emoji version.
update-emojis:
	uv run python ./scripts/update_emojis.py

.PHONY: update-notices
# Update the notices file (licenses of frontend assets and dependencies).
update-notices:
	cd frontend; \
		yarn licenses generate-disclaimer --production --recursive > ../NOTICES

	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Code/Source-Code.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Sans/Source-Sans.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Serif/Source-Serif.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/img/Material-Icons.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/img/Open-Iconic.LICENSE
	./scripts/append_license.sh frontend/lib/src/vendor/react-bootstrap-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/fzy.js/fzyjs-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/sprintf.js/sprintfjs-LICENSE.txt

.PHONY: update-headers
# Update all license headers.
update-headers:
	uv run pre-commit run insert-license --all-files --hook-stage manual
	uv run pre-commit run license-headers --all-files --hook-stage manual

.PHONY: update-min-deps
# Update minimum dependency constraints file.
update-min-deps:
	INSTALL_DEV_REQS=false INSTALL_TEST_REQS=false make python-init >/dev/null
	# Install streamlit in editable mode (needed by get_min_versions.py)
	uv pip install --editable ./lib --no-deps
	uv run python scripts/get_min_versions.py >scripts/assets/min-constraints-gen.txt

.PHONY: debug-e2e-test
# Run a playwright e2e test in debug mode. Use it via `make debug-e2e-test st_command_test.py`.
debug-e2e-test:
	@if [[ ! "$(filter-out $@,$(MAKECMDGOALS))" == *"_test"* ]]; then \
		echo "Error: Test script name must contain '_test' in the filename"; \
		exit 1; \
	fi
	@echo "Running test: $(filter-out $@,$(MAKECMDGOALS)) in debug mode."
	@if [[ -n "$$PYTEST_ADDOPTS" ]]; then \
		echo "Using PYTEST_ADDOPTS=$$PYTEST_ADDOPTS"; \
	fi
	@TEST_SCRIPT=$$(echo $(filter-out $@,$(MAKECMDGOALS)) | sed 's|^e2e_playwright/||'); \
	cd e2e_playwright && PWDEBUG=1 uv run pytest $$TEST_SCRIPT --tracing on || ( \
		echo "If you implemented changes in the frontend, make sure to call \`make frontend-fast\` to use the up-to-date frontend build in the test."; \
		echo "You can find test-results in ./e2e_playwright/test-results"; \
		exit 1 \
	)

.PHONY: run-e2e-test
# Run a playwright e2e test. Use it via `make run-e2e-test st_command_test.py`.
run-e2e-test:
	@if [[ ! "$(filter-out $@,$(MAKECMDGOALS))" == *"_test"* ]]; then \
		echo "Error: Test script name must contain '_test' in the filename"; \
		exit 1; \
	fi
	@echo "Running test: $(filter-out $@,$(MAKECMDGOALS))"
	@if [[ -n "$$PYTEST_ADDOPTS" ]]; then \
		echo "Using PYTEST_ADDOPTS=$$PYTEST_ADDOPTS"; \
	fi
	@TEST_SCRIPT=$$(echo $(filter-out $@,$(MAKECMDGOALS)) | sed 's|^e2e_playwright/||'); \
	cd e2e_playwright && uv run pytest $$TEST_SCRIPT --tracing retain-on-failure --reruns 0 || ( \
		echo "If you implemented changes in the frontend, make sure to call \`make frontend-fast\` to use the up-to-date frontend build in the test."; \
		echo "You can find test-results in ./e2e_playwright/test-results"; \
		exit 1 \
	)

.PHONY: trace-e2e-test
# Run e2e test with tracing and view it. Use via `make trace-e2e-test <test_file.py>::<test_func>`.
trace-e2e-test:
	@if [[ -z "$(filter-out $@,$(MAKECMDGOALS))" ]]; then \
		echo "Error: Please specify a single test to run"; \
		echo "Usage: make trace-e2e-test <test_file.py>::<test_function>"; \
		echo "Example: make trace-e2e-test st_audio_input_test.py::test_audio_input_renders"; \
		exit 1; \
	fi
	@TEST_ARG=$$(echo $(filter-out $@,$(MAKECMDGOALS)) | sed 's|^e2e_playwright/||'); \
	if [[ ! "$$TEST_ARG" == *"::"* ]]; then \
		echo "Error: You must specify a single test function, not an entire test file"; \
		echo "Usage: make trace-e2e-test <test_file.py>::<test_function>"; \
		echo "Example: make trace-e2e-test st_audio_input_test.py::test_audio_input_renders"; \
		exit 1; \
	fi; \
	echo "Clearing previous traces..."; \
	rm -rf e2e_playwright/test-results/traces; \
	mkdir -p e2e_playwright/test-results/traces; \
	echo "Running test with tracing: $$TEST_ARG"; \
	(cd e2e_playwright && uv run pytest $$TEST_ARG --tracing=on --output=test-results/traces || true); \
	echo ""; \
	echo "Launching trace viewer..."; \
	TRACE_FILE=$$(find e2e_playwright/test-results/traces -name "trace.zip" -type f 2>/dev/null | head -n 1); \
	if [[ -n "$$TRACE_FILE" ]]; then \
		uv run python -m playwright show-trace "$$TRACE_FILE"; \
	else \
		echo "No trace file found. Check e2e_playwright/test-results/traces/ directory."; \
	fi

.PHONY: lighthouse-tests
# Run Lighthouse performance tests.
lighthouse-tests:
	cd frontend/app; \
	yarn run lighthouse:run

.PHONY: bare-execution-tests
# Run all e2e tests in bare mode.
bare-execution-tests:
	PYTHONPATH=. \
	uv run python scripts/run_bare_execution_tests.py

.PHONY: cli-smoke-tests
# Run CLI smoke tests.
cli-smoke-tests:
	uv run python scripts/cli_smoke_tests.py

.PHONY: check
# Run all checks (format, lint, types, unit tests) on changed files only. Useful to verify the current state of the codebase before committing.
check:
	@echo "=== Checking changed files ==="
	@CHANGED=$$(uv run python scripts/get_changed_files.py --all); \
	if [ -z "$$CHANGED" ]; then \
		echo "No changed files found."; \
		exit 0; \
	fi; \
	echo "Changed files:"; \
	echo "$$CHANGED" | tr ' ' '\n' | sed 's/^/  /'; \
	echo ""
	@# Start frontend (format, lint, types, tests) in background, run Python + pre-commit + Python tests in foreground
	@# Set FAST_CHECK=true to skip mypy, frontend-types, and unit tests
	@# Note: ty runs on all files (not just changed) because include/exclude config is ignored for single files, and ty is fast
	@FE_OUT=$$(mktemp) || { echo "Failed to create temp file"; exit 1; }; \
	FE_FILES=$$(uv run python scripts/get_changed_files.py --frontend --strip-prefix frontend/); \
	FE_CHECK=$$(uv run python scripts/get_changed_files.py --frontend); \
	FE_TESTS=$$(uv run python scripts/get_changed_files.py --frontend-tests --strip-prefix frontend/); \
	( \
		if [ -n "$$FE_FILES" ]; then \
			echo "=== Frontend: format (prettier) ===" && \
			cd frontend && yarn exec prettier --write $$FE_FILES && \
			cd .. && \
			echo "" && \
			echo "=== Frontend: lint (eslint) ===" && \
			cd frontend && yarn exec eslint --fix $$FE_FILES && \
			cd .. && \
			echo ""; \
		else \
			echo "No frontend files changed." && \
			echo ""; \
		fi && \
		if [ -n "$$FE_CHECK" ] && [ "$$FAST_CHECK" != "true" ]; then \
			echo "=== Frontend: type check (tsc) ===" && \
			$(MAKE) frontend-types && \
			echo ""; \
		fi && \
		if [ -n "$$FE_TESTS" ] && [ "$$FAST_CHECK" != "true" ]; then \
			echo "=== Frontend: tests (vitest) ===" && \
			echo "Running: $$FE_TESTS" && \
			cd frontend && yarn vitest run $$FE_TESTS; \
		fi \
	) > "$$FE_OUT" 2>&1 & FE_PID=$$!; \
	PY_FILES=$$(uv run python scripts/get_changed_files.py --python); \
	PY_EXIT=0; \
	if [ -n "$$PY_FILES" ]; then \
		echo "=== Python: lint (ruff) ===" && \
		uv run ruff check --fix $$PY_FILES && \
		echo "" && \
		echo "=== Python: format (ruff) ===" && \
		uv run ruff format $$PY_FILES && \
		echo "" && \
		echo "=== Python: type check (ty) ===" && \
		uv run ty check && \
		echo "" || PY_EXIT=1; \
		if [ $$PY_EXIT -eq 0 ] && [ "$$FAST_CHECK" != "true" ]; then \
			echo "=== Python: type check (mypy) ===" && \
			uv run mypy $$PY_FILES && \
			echo "" || PY_EXIT=1; \
		fi; \
	else \
		echo "No Python files changed."; \
		echo ""; \
	fi; \
	if [ $$PY_EXIT -ne 0 ]; then \
		kill $$FE_PID 2>/dev/null; \
		rm -f "$$FE_OUT"; \
		echo "=== Python checks failed! ==="; \
		exit 1; \
	fi; \
	CHANGED=$$(uv run python scripts/get_changed_files.py --all); \
	if [ -n "$$CHANGED" ]; then \
		echo "=== Pre-commit hooks ===" && \
		SKIP=prettier-frontend uv run pre-commit run --files $$CHANGED && \
		echo "" || { \
			kill $$FE_PID 2>/dev/null; \
			rm -f "$$FE_OUT"; \
			echo "=== Pre-commit hooks failed! ==="; \
			exit 1; \
		}; \
	fi; \
	PY_TESTS=$$(uv run python scripts/get_changed_files.py --python-tests); \
	if [ -n "$$PY_TESTS" ] && [ "$$FAST_CHECK" != "true" ]; then \
		echo "=== Python: tests (pytest) ===" && \
		echo "Running: $$PY_TESTS" && \
		uv run pytest -c lib/pyproject.toml -v $$PY_TESTS && \
		echo "" || { \
			kill $$FE_PID 2>/dev/null; \
			rm -f "$$FE_OUT"; \
			echo "=== Python tests failed! ==="; \
			exit 1; \
		}; \
	fi; \
	FE_EXIT=0; \
	wait $$FE_PID || FE_EXIT=1; \
	cat "$$FE_OUT"; \
	rm -f "$$FE_OUT"; \
	if [ $$FE_EXIT -ne 0 ]; then \
		echo "=== Frontend checks failed! ==="; \
		exit 1; \
	fi
	@echo "=== All checks passed! ==="

.PHONY: autofix
# Autofix linting and formatting errors.
autofix:
	# Python fixes:
	uv run ruff check --fix
	make python-format
	# JS fixes:
	make frontend-init
	make frontend-format
	cd frontend/ ; yarn lint:fix
	# Dedupe yarn.lock
	cd frontend ; yarn dedupe
	# Other fixes:
	make update-notices
	# Run all pre-commit fixes but not fail if any of them don't work.
	uv run pre-commit run --all-files --hook-stage manual || true

.PHONY: package
# Create Python wheel files in `dist/`.
package: init frontend
	# Get rid of the old build and dist folders to make sure that we clean old js and css.
	rm -rfv lib/build lib/dist
	# Copy README.md to lib/ for the package build (pyproject.toml expects it there)
	cp README.md lib/README.md
	cd lib && uv build
	# Clean up the copied README.md
	rm -f lib/README.md

# Targets that accept positional arguments (e.g., `make debug my-script.py`)
TARGETS_WITH_ARGS := debug debug-e2e-test run-e2e-test trace-e2e-test

# Catch-all target to allow passing arguments to the above targets.
# Without this, Make interprets arguments as targets and exits with error code 2.
# Only silently succeeds if invoked as an argument to a known target; otherwise fails
# to catch typos like `make fronted-dev`.
%:
	@if ! echo "$(TARGETS_WITH_ARGS)" | grep -qw "$(firstword $(MAKECMDGOALS))"; then \
		echo "Error: Unknown target '$@'. Run 'make help' to see available targets."; \
		exit 1; \
	fi
