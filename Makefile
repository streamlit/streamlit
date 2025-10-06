# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
	pre-commit install
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
	rm -rf lib/conda-recipe/dist
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
	rm -rf frontend/node_modules
	rm -rf frontend/app/performance/lighthouse/reports
	rm -rf frontend/app/node_modules
	rm -rf frontend/lib/node_modules
	rm -rf frontend/connection/node_modules
	rm -rf frontend/test_results
	rm -f frontend/protobuf/src/proto.js
	rm -f frontend/protobuf/src/proto.d.ts
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
	protoc \
		--proto_path=proto \
		--python_out=lib \
		--mypy_out=lib \
		proto/streamlit/proto/*.proto

	@# JS/TS protobuf generation
	cd frontend/ ; yarn workspace @streamlit/protobuf run generate-protobuf


.PHONY: python-init
# Install Python dependencies and Streamlit in editable mode.
python-init:
	pip_args=("--editable" "./lib");\
	if [ "${INSTALL_DEV_REQS}" = "true" ] ; then\
		pip_args+=("--requirement" "lib/dev-requirements.txt"); \
	fi;\
	if [ "${INSTALL_TEST_REQS}" = "true" ] ; then\
		pip_args+=("--requirement" "lib/test-requirements.txt"); \
	fi;\
	if command -v "uv" > /dev/null; then \
		echo "Running command: uv pip install $${pip_args[@]}"; \
		uv pip install $${pip_args[@]}; \
	else \
		echo "Running command: pip install $${pip_args[@]}"; \
		pip install $${pip_args[@]}; \
	fi;\
	if [ "${INSTALL_TEST_REQS}" = "true" ] && [ "${INSTALL_PLAYWRIGHT}" = "true" ] ; then\
		python -m playwright install --with-deps; \
	fi;

.PHONY: python-lint
# Lint and check formatting of Python files.
python-lint:
	# Checks if the formatting is correct:
	ruff format --check
	# Run linter:
	ruff check

.PHONY: python-format
# Format Python files.
python-format:
	# Sort imports ( see https://docs.astral.sh/ruff/formatter/#sorting-imports )
	ruff check --select I --fix
	# Run code formatter
	ruff format

.PHONY: python-tests
# Run Python unit tests.
python-tests:
	cd lib; \
		PYTHONPATH=. \
		pytest -v -l \
			-m "not performance" \
			tests/

.PHONY: python-performance-tests
# Run Python performance tests.
python-performance-tests:
	cd lib; \
		PYTHONPATH=. \
		pytest -v -l \
			-m "performance" \
			--benchmark-autosave \
			--benchmark-storage file://../.benchmarks/pytest \
			tests/

.PHONY: python-integration-tests
# Run Python integration tests. Requires `integration-requirements.txt` to be installed.
python-integration-tests:
	cd lib; \
		PYTHONPATH=. \
		pytest -v -l \
			--require-integration \
			tests/

.PHONY: python-types
# Run the Python type checker.
python-types:
	# Run ty type checker:
	ty check
	# Run mypy type checker:
	mypy --config-file=mypy.ini


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
	cd frontend/ ; yarn workspaces foreach --all --topological run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/
	# Move manifest.json to a location that can actually be served by the Tornado
	# server's static asset handler.
	mv lib/streamlit/static/.vite/manifest.json lib/streamlit/static

.PHONY: frontend-with-profiler
# Build the frontend with the profiler enabled.
frontend-with-profiler:
	# Build frontend dependent libraries (excluding app and lib):
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/app --exclude @streamlit/lib --topological run build
	# Build the app with the profiler enabled:
	cd frontend/ ; yarn workspace @streamlit/app buildWithProfiler
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-fast
# Build the frontend (as fast as possible).
frontend-fast:
	cd frontend/ ; yarn workspaces foreach --recursive --topological --from @streamlit/app --exclude @streamlit/lib run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-dev
# Start the frontend development server.
frontend-dev:
	cd frontend/ ; yarn start

.PHONY: frontend-lint
# Lint and check formatting of frontend files.
frontend-lint:
	cd frontend/ ; yarn workspaces foreach --all run formatCheck
	cd frontend/ ; yarn workspaces foreach --all run lint

.PHONY: frontend-types
# Run the frontend type checker.
frontend-types:
	cd frontend/ ; yarn workspaces foreach --all run typecheck

.PHONY: frontend-format
# Format frontend files.
frontend-format:
	cd frontend/ ; yarn workspaces foreach --all run format

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
	python ./scripts/update_e2e_snapshots.py

.PHONY: update-snapshots-changed
# Update e2e playwright snapshots of changed e2e files based on the latest completed CI run.
update-snapshots-changed:
	python ./scripts/update_e2e_snapshots.py --changed

.PHONY: update-material-icons
# Update material icons based on latest Google material symbol version.
update-material-icons:
	python ./scripts/update_material_icon_font_and_names.py

.PHONY: update-emojis
# Update emojis based on latest emoji version.
update-emojis:
	python ./scripts/update_emojis.py

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
	./scripts/append_license.sh frontend/lib/src/vendor/bokeh/bokeh-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/react-bootstrap-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/fzy.js/fzyjs-LICENSE.txt

.PHONY: update-headers
# Update all license headers.
update-headers:
	pre-commit run insert-license --all-files --hook-stage manual
	pre-commit run license-headers --all-files --hook-stage manual

.PHONY: update-min-deps
# Update minimum dependency constraints file.
update-min-deps:
	INSTALL_DEV_REQS=false INSTALL_TEST_REQS=false make python-init >/dev/null
	python scripts/get_min_versions.py >scripts/assets/min-constraints-gen.txt

.PHONY: debug-e2e-test
# Run a playwright e2e test in debug mode. Use it via `make debug-e2e-test st_command_test.py`.
debug-e2e-test:
	@if [[ ! "$(filter-out $@,$(MAKECMDGOALS))" == *"_test"* ]]; then \
		echo "Error: Test script name must contain '_test' in the filename"; \
		exit 1; \
	fi
	@echo "Running test: $(filter-out $@,$(MAKECMDGOALS)) in debug mode."
	@TEST_SCRIPT=$$(echo $(filter-out $@,$(MAKECMDGOALS)) | sed 's|^e2e_playwright/||'); \
	cd e2e_playwright && PWDEBUG=1 pytest $$TEST_SCRIPT --tracing on || ( \
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
	@TEST_SCRIPT=$$(echo $(filter-out $@,$(MAKECMDGOALS)) | sed 's|^e2e_playwright/||'); \
	cd e2e_playwright && pytest $$TEST_SCRIPT --tracing retain-on-failure --reruns 0 || ( \
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
	(cd e2e_playwright && pytest $$TEST_ARG --tracing=on --output=test-results/traces || true); \
	echo ""; \
	echo "Launching trace viewer..."; \
	TRACE_FILE=$$(find e2e_playwright/test-results/traces -name "trace.zip" -type f 2>/dev/null | head -n 1); \
	if [[ -n "$$TRACE_FILE" ]]; then \
		python -m playwright show-trace "$$TRACE_FILE"; \
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
	python3 scripts/run_bare_execution_tests.py

.PHONY: cli-smoke-tests
# Run CLI smoke tests.
cli-smoke-tests:
	python3 scripts/cli_smoke_tests.py

.PHONY: autofix
# Autofix linting and formatting errors.
autofix:
	# Python fixes:
	make python-format
	ruff check --fix
	# JS fixes:
	make frontend-init
	make frontend-format
	cd frontend/ ; yarn workspaces foreach --all run lint --fix
	# Other fixes:
	make update-notices
	# Run all pre-commit fixes but not fail if any of them don't work.
	pre-commit run --all-files --hook-stage manual || true

.PHONY: package
# Create Python wheel files in `dist/`.
package: init frontend
	# Get rid of the old build and dist folders to make sure that we clean old js and css.
	rm -rfv lib/build lib/dist
	cd lib ; python3 setup.py bdist_wheel sdist

.PHONY: conda-package
# Create conda distribution files.
conda-package: init
	if [ "${SNOWPARK_CONDA_BUILD}" = "1" ] ; then\
		echo "Creating Snowpark conda build, so skipping building frontend assets."; \
	else \
		make frontend; \
	fi
	rm -rf lib/conda-recipe/dist
	mkdir lib/conda-recipe/dist
	# This can take upwards of 20 minutes to complete in a fresh conda installation! (Dependency solving is slow.)
	# NOTE: Running the following command requires both conda and conda-build to
	# be installed.
	GIT_HASH=$$(git rev-parse --short HEAD) conda build lib/conda-recipe --output-folder lib/conda-recipe/dist
