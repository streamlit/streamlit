# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
USE_CONSTRAINTS_FILE ?= true
PYTHON_VERSION := $(shell python --version | cut -d " " -f 2 | cut -d "." -f 1-2)
GITHUB_REPOSITORY ?= streamlit/streamlit
CONSTRAINTS_BRANCH ?= constraints-develop
CONSTRAINTS_URL ?= https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${CONSTRAINTS_BRANCH}/constraints-${PYTHON_VERSION}.txt

# Black magic to get module directories
PYTHON_MODULES := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

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
all-devel: init develop pre-commit-install
	@echo ""
	@echo "    The frontend has *not* been rebuilt."
	@echo "    If you need to make a wheel file or test S3 sharing, run:"
	@echo ""
	@echo "    make frontend"
	@echo ""

.PHONY: mini-devel
# Get minimal dependencies for development and install Streamlit into Python environment -- but do not build the frontend.
mini-devel: mini-init develop pre-commit-install

.PHONY: build-deps
# An even smaller installation than mini-devel. Installs the bare minimum necessary to build Streamlit (by leaving out some dependencies necessary for the development process). Does not build the frontend.
build-deps: mini-init develop

.PHONY: init
# Install all Python and JS dependencies.
init: python-init-all react-init protobuf

.PHONY: mini-init
# Install minimal Python and JS dependencies for development.
mini-init: python-init-dev-only react-init protobuf

.PHONY: frontend
# Build frontend into static files.
frontend: react-build

.PHONY: install
# Install Streamlit into your Python environment.
install:
	cd lib ; python setup.py install

.PHONY: develop
# Install Streamlit as links in your Python environment, pointing to local workspace.
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

.PHONY: python-init-test-only
# Install Streamlit and test requirements.
python-init-test-only: lib/test-requirements.txt
	INSTALL_DEV_REQS=false INSTALL_TEST_REQS=true make python-init

.PHONY: python-init
python-init:
	pip_args=("--editable" "./lib");\
	if [ "${USE_CONSTRAINTS_FILE}" = "true" ] ; then\
		pip_args+=(--constraint "${CONSTRAINTS_URL}"); \
	fi;\
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
			$(PYTHON_MODULES)

# Run Python integration tests.
# This requires the integration-requirements to be installed.
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
	mypy --config-file=lib/mypy.ini --namespace-packages lib/streamlit/ lib/tests/streamlit/typing/ scripts/

.PHONY: bare-execution-tests
# Run all our e2e tests in "bare" mode and check for non-zero exit codes.
bare-execution-tests:
	python3 scripts/run_bare_execution_tests.py

.PHONY: cli-smoke-tests
# Verify that CLI boots as expected when called with `python -m streamlit`.
cli-smoke-tests:
	python3 scripts/cli_smoke_tests.py

.PHONY: cli-regression-tests
# Verify that CLI boots as expected when called with `python -m streamlit`.
cli-regression-tests: install
	pytest scripts/cli_regression_tests.py

.PHONY: distribution
# Create Python distribution files in dist/.
distribution:
	# Get rid of the old build and dist folders to make sure that we clean old js and css.
	rm -rfv lib/build lib/dist
	cd lib ; python3 setup.py bdist_wheel --universal sdist

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
	rm -rf .mypy_cache
	rm -rf .ruff_cache
	rm -f lib/streamlit/proto/*_pb2.py*
	rm -rf lib/streamlit/static
	rm -f lib/Pipfile.lock
	rm -rf frontend/app/build
	rm -rf frontend/node_modules
	rm -rf frontend/app/node_modules
	rm -rf frontend/lib/node_modules
	rm -rf frontend/test_results
	rm -f frontend/lib/src/proto.js
	rm -f frontend/lib/src/proto.d.ts
	rm -rf frontend/public/reports
	rm -rf frontend/lib/dist
	rm -rf ~/.cache/pre-commit
	rm -rf e2e_playwright/test-results
	find . -name .streamlit -type d -exec rm -rfv {} \; || true
	cd lib; rm -rf .coverage .coverage\.*

MIN_PROTOC_VERSION = 3.20
.PHONY: check-protoc
# Ensure protoc is installed and is >= MIN_PROTOC_VERSION.
check-protoc:
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
	fi

.PHONY: protobuf
# Recompile Protobufs for Python and the frontend.
protobuf: check-protoc
	protoc \
		--proto_path=proto \
		--python_out=lib \
		--mypy_out=lib \
		proto/streamlit/proto/*.proto

	@# JS protobuf generation. The --es6 flag generates a proper es6 module.
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		yarn --silent pbjs \
			../proto/streamlit/proto/*.proto \
			--path=../proto -t static-module --wrap es6 \
	) > ./lib/src/proto.js

	@# Typescript type declarations for our generated protobufs
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		yarn --silent pbts ./lib/src/proto.js \
	) > ./lib/src/proto.d.ts

.PHONY: react-init
# React init.
react-init:
	cd frontend/ ; yarn install --frozen-lockfile

.PHONY: react-build
# React build.
react-build:
	cd frontend/ ; yarn run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-fast
# Build frontend into static files faster by setting BUILD_AS_FAST_AS_POSSIBLE=true flag, which disables eslint and typechecking.
frontend-fast:
	cd frontend/ ; yarn run buildFast
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/app/build/ lib/streamlit/static/

.PHONY: frontend-lib
# Build the frontend library.
frontend-lib:
	cd frontend/ ; yarn run buildLib;

.PHONY: frontend-app
# Build the frontend app. One must build the frontend lib first before building the app.
frontend-app:
	cd frontend/ ; yarn run buildApp

.PHONY: jslint
# Lint the JS code.
jslint:
	cd frontend; \
		yarn lint;

.PHONY: tstypecheck
# Typecheck the JS/TS code.
tstypecheck:
	pre-commit run typecheck-lib --all-files --hook-stage manual && pre-commit run typecheck-app --all-files --hook-stage manual

.PHONY: jsformat
# Fix formatting issues in our JavaScript & TypeScript files.
jsformat:
	pre-commit run prettier --all-files --hook-stage manual

.PHONY: jstest
# Run JS unit tests.
jstest:
	cd frontend; TESTPATH=$(TESTPATH) yarn run test

.PHONY: jstestcoverage
# Run JS unit tests and generate a coverage report.
jstestcoverage:
	cd frontend; TESTPATH=$(TESTPATH) yarn run testcoverage

.PHONY: playwright
# Run playwright E2E tests (without custom component tests).
custom_components_test_folder = ./custom_components
playwright:
	cd e2e_playwright; \
	rm -rf ./test-results; \
	pytest --ignore ${custom_components_test_folder} --browser webkit --browser chromium --browser firefox --video retain-on-failure --screenshot only-on-failure --output ./test-results/ -n auto --reruns 1 --reruns-delay 1 --rerun-except "Missing snapshot" --durations=5 -r aR -v
.PHONY: playwright-custom-components
# Run playwright custom component E2E tests.
playwright-custom-components:
	cd e2e_playwright; \
	rm -rf ./test-results; \
	pip_args="extra-streamlit-components streamlit-ace streamlit-antd-components streamlit-aggrid streamlit-autorefresh streamlit-chat streamlit-echarts streamlit-folium streamlit-option-menu streamlit-url-fragment"; \
	if command -v "uv" > /dev/null; then \
		echo "Running command: uv pip install $${pip_args}"; \
		uv pip install $${pip_args}; \
	else \
		echo "Running command: pip install $${pip_args}"; \
		pip install $${pip_args}; \
	fi; \
	pytest ${custom_components_test_folder} --browser webkit --browser chromium --browser firefox --video retain-on-failure --screenshot only-on-failure --output ./test-results/ -n auto --reruns 1 --reruns-delay 1 --rerun-except "Missing snapshot" --durations=5 -r aR -v

.PHONY: loc
# Count the number of lines of code in the project.
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/streamlit\/proto)|(dist\/)" | \
		xargs wc

.PHONY: distribute
# Upload the package to PyPI.
distribute:
	cd lib/dist; \
		twine upload $$(ls -t *.whl | head -n 1); \
		twine upload $$(ls -t *.tar.gz | head -n 1)

.PHONY: notices
# Rebuild the NOTICES file.
notices:
	cd frontend; \
		yarn licenses generate-disclaimer --silent --production --ignore-platform > ../NOTICES

	@# When `yarn licenses` is run in a yarn workspace, it misnames the project as
	@# "WORKSPACE AGGREGATOR 2B7C80A7 6734 4A68 BB93 8CC72B9A5DEA". We fix that here.
	@# There also isn't a portable way to invoke `sed` to edit files in-place, so we have
	@# sed create a NOTICES.bak backup file that we immediately delete afterwards.
	sed -i'.bak' 's/PORTIONS OF THE .*PRODUCT/PORTIONS OF THE STREAMLIT PRODUCT/' NOTICES
	rm -f NOTICES.bak

	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Code_Pro/Source-Code-Pro.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Sans_Pro/Source-Sans-Pro.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/fonts/Source_Serif_Pro/Source-Serif-Pro.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/img/Material-Icons.LICENSE
	./scripts/append_license.sh frontend/app/src/assets/img/Open-Iconic.LICENSE
	./scripts/append_license.sh frontend/lib/src/vendor/bokeh/bokeh-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/twemoji-LICENSE.txt
	./scripts/append_license.sh frontend/app/src/vendor/Segment-LICENSE.txt
	./scripts/append_license.sh frontend/lib/src/vendor/react-bootstrap-LICENSE.txt
	./scripts/append_license.sh lib/streamlit/vendor/ipython/IPython-LICENSE.txt

.PHONY: headers
# Update the license header on all source files.
headers:
	pre-commit run insert-license --all-files --hook-stage manual
	pre-commit run license-headers --all-files --hook-stage manual

.PHONY: gen-min-dep-constraints
# Write the minimum versions of our dependencies to a constraints file.
gen-min-dep-constraints:
	make develop >/dev/null
	python scripts/get_min_versions.py >lib/min-constraints-gen.txt

.PHONY: pre-commit-install
# Pre-commit install.
pre-commit-install:
	pre-commit install

.PHONY: ensure-relative-imports
# Ensure relative imports exist within the lib/dist folder when doing yarn buildLibProd.
ensure-relative-imports:
	./scripts/ensure_relative_imports.sh

.PHONY frontend-lib-prod:
# Build the production version for @streamlit/lib.
frontend-lib-prod:
	cd frontend/ ; yarn run buildLibProd;

.PHONY streamlit-lib-prod:
# Build the production version for @streamlit/lib while also doing a make init so it's a single command.
streamlit-lib-prod:
	make mini-init;
	make frontend-lib-prod;

