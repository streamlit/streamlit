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

# Make uses /bin/sh by default, but we are using some bash features.  On Ubuntu
# /bin/sh is POSIX compliant, ie it's not bash.  So let's be explicit:
SHELL=/bin/bash

INSTALL_DEV_REQS ?= true
INSTALL_TEST_REQS ?= true
PYTHON_VERSION := $(shell python --version | cut -d " " -f 2 | cut -d "." -f 1-2)
MIN_PROTOC_VERSION = 3.20

# Black magic to get module directories
PYTHON_MODULES := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

# Check if Python is installed and can be executed, otherwise show an error message in red (but continue)
ifeq ($(PYTHON_VERSION),)
error_message="Error: Python version is not detected. Please ensure Python is installed and accessible in your PATH."
error_message_red_colored=$(shell echo -e "\033[0;31m ${error_message} \033[0m")
$(warning ${error_message_red_colored})
endif

.PHONY: help
help:
	@# Magic line used to create self-documenting makefiles.
	@# Note that this means the documenting comment just before the command (but after the .PHONY) must be all one line, and should begin with a capital letter and end with a period.
	@# See https://stackoverflow.com/a/35730928
	@awk '/^#/{c=substr($$0,3);next}c&&/^[[:alpha:]][[:alnum:]_-]+:/{print substr($$1,1,index($$1,":")),c}1{c=0}' Makefile | column -s: -t

.PHONY: all
# Get dependencies, build frontend, install Streamlit into Python environment.
all: init frontend install

.PHONY: all-devel
# Get dependencies and install Streamlit into Python environment -- but do not build the frontend.
all-devel: init develop pre-commit-install frontend-dependencies
	@echo ""
	@echo "    The frontend has *not* been rebuilt."
	@echo "    If you need to make a wheel file, run:"
	@echo ""
	@echo "    make frontend"
	@echo ""

.PHONY: mini-devel
# Get minimal dependencies for development and install Streamlit into Python environment -- but do not build the frontend.
mini-devel: mini-init frontend-dependencies

.PHONY: build-deps
# An even smaller installation than mini-devel. Installs the bare minimum necessary to build Streamlit (by leaving out some dependencies necessary for the development process). Does not build the frontend.
build-deps: mini-init develop

.PHONY: init
# Install all Python and JS dependencies.
init: python-init-all react-init protobuf

.PHONY: mini-init
# Install minimal Python and JS dependencies for development.
mini-init: python-init-dev-only react-init protobuf

.PHONY: develop
# Installs Streamlit as editable install in your Python environment.
develop:
	INSTALL_DEV_REQS=false INSTALL_TEST_REQS=false make python-init

.PHONY: python-init-all
# Install Streamlit and all (test and dev) requirements.
python-init-all:
	INSTALL_DEV_REQS=true INSTALL_TEST_REQS=true make python-init

.PHONY: python-init-dev-only
# Install Streamlit and dev requirements.
python-init-dev-only:
	INSTALL_DEV_REQS=true INSTALL_TEST_REQS=false make python-init

.PHONY: python-init
# Install python dependencies and Streamlit as editable install in your Python environment.
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
	if [ "${INSTALL_TEST_REQS}" = "true" ] ; then\
		python -m playwright install --with-deps; \
	fi;\

.PHONY: pylint
# Verify that our Python files are properly formatted and that there are no lint errors.
pylint:
	# Checks if the formatting is correct:
	ruff format --check
	# Run linter:
	ruff check

.PHONY: pyformat
# Fix Python files that are not properly formatted.
pyformat:
	# Sort imports ( see https://docs.astral.sh/ruff/formatter/#sorting-imports )
	ruff check --select I --fix
	# Run code formatter
	ruff format

.PHONY: pytest
# Run Python unit tests.
pytest:
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			-l tests/ \
			-m "not performance" \
			$(PYTHON_MODULES)

.PHONY: performance-pytest
# Run Python benchmark tests
performance-pytest:
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			-l tests/ \
			-m "performance" \
			--benchmark-autosave \
			--benchmark-storage file://../.benchmarks/pytest \
			$(PYTHON_MODULES)

.PHONY: pytest-integration
# Run Python integration tests. This requires the integration-requirements to be installed.
pytest-integration:
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			--require-integration \
			-l tests/ \
			$(PYTHON_MODULES)

.PHONY: mypy
# Run Mypy static type checker.
mypy:
	mypy --config-file=mypy.ini

.PHONY: bare-execution-tests
# Run all our e2e tests in "bare" mode and check for non-zero exit codes.
bare-execution-tests:
	PYTHONPATH=. \
	python3 scripts/run_bare_execution_tests.py

.PHONY: cli-smoke-tests
# Verify that CLI boots as expected when called with `python -m streamlit`.
cli-smoke-tests:
	python3 scripts/cli_smoke_tests.py

.PHONY: distribution
# Create Python distribution files in dist/.
distribution:
	# Get rid of the old build and dist folders to make sure that we clean old js and css.
	rm -rfv lib/build lib/dist
	cd lib ; python3 setup.py bdist_wheel sdist

.PHONY: package
# Build lib and frontend, and then run 'distribution'.
package: build-deps frontend distribution

.PHONY: conda-distribution
# Create conda distribution files in lib/conda-recipe/dist.
conda-distribution:
	rm -rf lib/conda-recipe/dist
	mkdir lib/conda-recipe/dist
	# This can take upwards of 20 minutes to complete in a fresh conda installation! (Dependency solving is slow.)
	# NOTE: Running the following command requires both conda and conda-build to
	# be installed.
	GIT_HASH=$$(git rev-parse --short HEAD) conda build lib/conda-recipe --output-folder lib/conda-recipe/dist

.PHONY: conda-package
# Build lib and (maybe) frontend assets, and then run 'conda-distribution'.
conda-package: build-deps
	if [ "${SNOWPARK_CONDA_BUILD}" = "1" ] ; then\
		echo "Creating Snowpark conda build, so skipping building frontend assets."; \
	else \
		make frontend; \
	fi
	make conda-distribution;

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

.PHONY: react-init
# Install all frontend dependencies.
react-init:
	cd frontend/ ; \
	if command -v "corepack" > /dev/null; then \
		corepack install ; \
	fi;\
	yarn install --immutable

.PHONY: frontend
# Build frontend into static files.
frontend:
	cd frontend/ ; yarn workspaces foreach --all --topological run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/
	# Move manifest.json to a location that can actually be served by the Tornado
	# server's static asset handler.
	mv lib/streamlit/static/.vite/manifest.json lib/streamlit/static

.PHONY: frontend-dependencies
# Build frontend dependent libraries (excluding app and lib)
frontend-dependencies:
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/app --exclude @streamlit/lib --topological run build

.PHONY: frontend-build-with-profiler
# Build the frontend with the profiler enabled.
frontend-build-with-profiler: frontend-dependencies
	cd frontend/ ; yarn workspace @streamlit/app buildWithProfiler
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-fast
# Build the frontend (as fast as possible)
frontend-fast:
	cd frontend/ ; yarn workspaces foreach --recursive --topological --from @streamlit/app --exclude @streamlit/lib run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-dev
# Build frontend dependencies and start the dev server.
frontend-dev: frontend-dependencies
	cd frontend/ ; yarn dev

.PHONY: frontend-lib
# Build the frontend library.
frontend-lib:
	cd frontend/ ; yarn workspaces foreach --recursive --topological --from @streamlit/lib run build;

.PHONY: jslint
# Verify that our JS/TS code is formatted and that there are no lint errors.
jslint: frontend-dependencies
	cd frontend/ ; yarn workspaces foreach --all run formatCheck
	cd frontend/ ; yarn workspaces foreach --all run lint

.PHONY: tstypecheck
# Typecheck the JS/TS code.
tstypecheck: frontend-dependencies
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/lib --exclude @streamlit/app run typecheck
	cd frontend/ ; yarn workspaces foreach --all run typecheck

.PHONY: jsformat
# Fix formatting issues in our JavaScript & TypeScript files.
jsformat:
	cd frontend/ ; yarn workspaces foreach --all run format

.PHONY: jstest
# Run JS unit tests.
jstest: frontend-dependencies
	cd frontend; TESTPATH=$(TESTPATH) yarn test

.PHONY: jstestcoverage
# Run JS unit tests and generate a coverage report.
jstestcoverage: frontend-dependencies
	cd frontend; TESTPATH=$(TESTPATH) yarn testCoverage

.PHONY: update-snapshots
# Update e2e playwright snapshots based on the latest completed CI run.
update-snapshots:
	python ./scripts/update_e2e_snapshots.py

.PHONY: update-snapshots-changed
# Update e2e playwright snapshots of changed files based on the latest completed CI run.
update-snapshots-changed:
	python ./scripts/update_e2e_snapshots.py --changed

.PHONY: update-material-icons
# Update material icon names and font file based on latest google material symbol rounded font version.
update-material-icons:
	python ./scripts/update_material_icon_font_and_names.py


.PHONY: notices
# Rebuild the NOTICES file.
notices:
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

.PHONY: headers
# Update the license header on all source files.
headers:
	pre-commit run insert-license --all-files --hook-stage manual
	pre-commit run license-headers --all-files --hook-stage manual

.PHONY: gen-min-dep-constraints
# Write the minimum versions of our dependencies to a constraints file.
gen-min-dep-constraints:
	make develop >/dev/null
	python scripts/get_min_versions.py >scripts/assets/min-constraints-gen.txt

.PHONY: pre-commit-install
# Pre-commit install.
pre-commit-install:
	pre-commit install

.PHONY: performance-lighthouse
# Run Lighthouse performance tests
performance-lighthouse:
	cd frontend/app; \
	yarn run lighthouse:run

.PHONY: debug-e2e-test
# Run an e2e playwright test in debug mode with Playwright Inspector. Use it via make debug-e2e-test st_command_test.py
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
# Run an e2e playwright test. Use it via make run-e2e-test st_command_test.py
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

.PHONY: autofix
# Autofix linting and formatting errors.
autofix:
	# Python fixes:
	make pyformat
	ruff check --fix
	# JS fixes:
	make react-init
	make jsformat
	cd frontend/ ; yarn workspaces foreach --all run lint --fix
	# Other fixes:
	make notices
	# Run all pre-commit fixes but not fail if any of them don't work.
	pre-commit run --all-files --hook-stage manual || true

.PHONY: frontend-typesync
# Run typesync in each frontend workspace to check for unsynced types.
# If types are unsynced, print a message and exit with a non-zero exit code.
frontend-typesync:
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/typescript-config run typesync:ci --dry=fail || (\
		echo -e "\033[0;31mTypesync check failed. Run 'make frontend-typesync-update' to fix.\033[0m"; \
		exit 1 \
	)

.PHONY: frontend-typesync-update
# Run typesync in each frontend workspace to update types.
frontend-typesync-update:
	cd frontend/ ; yarn workspaces foreach --all --exclude @streamlit/typescript-config run typesync
	cd frontend/ ; yarn
	cd component-lib/ ; yarn typesync
	cd component-lib/ ; yarn
