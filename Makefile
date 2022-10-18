# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

# Black magic to get module directories
PYTHON_MODULES := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

.PHONY: help
help:
	@# Magic line used to create self-documenting makefiles.
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
# Get minimal dependencies and install Streamlit into Python environment -- but do not build the frontend.
mini-devel: mini-init develop pre-commit-install

.PHONY: init
# Install all Python and JS dependencies.
init: setup pipenv-install react-init protobuf

.PHONY: mini-init
# Install minimal Python and JS dependencies for development.
mini-init: setup pipenv-dev-install react-init protobuf

.PHONY: frontend
# Build frontend into static files.
frontend: react-build

.PHONY: setup
setup:
	pip install pip-tools pipenv ;

.PHONY: pipenv-install
pipenv-install: pipenv-dev-install py-test-install

.PHONY: pipenv-dev-install
pipenv-dev-install: lib/Pipfile
	# Run pipenv install; don't update the Pipfile.lock.
	# The lockfile is created to force resolution of all dependencies at once,
	# but we don't actually want to use the lockfile.
	cd lib; \
		rm Pipfile.lock; \
		pipenv install --dev

SHOULD_INSTALL_TENSORFLOW := $(shell python scripts/should_install_tensorflow.py)
.PHONY: py-test-install
py-test-install: lib/test-requirements.txt
	# As of Python 3.9, we're using pip's legacy-resolver when installing
	# test-requirements.txt, because otherwise pip takes literal hours to finish.
	pip install -r lib/test-requirements.txt --use-deprecated=legacy-resolver
ifeq (${SHOULD_INSTALL_TENSORFLOW},true)
	pip install -r lib/test-requirements-with-tensorflow.txt --use-deprecated=legacy-resolver
else
	@echo ""
	@echo "Your system does not support the official, pre-built tensorflow binaries."
	@echo "This generally happens because you are running Python 3.10 or have an Apple Silicon machine."
	@echo "Skipping incompatible dependencies."
	@echo ""
endif

.PHONY: pylint
# Verify that our Python files are properly formatted.
pylint:
	# Does not modify any files. Returns with a non-zero
	# status if anything is not properly formatted. (This isn't really
	# "linting"; we're not checking anything but code style.)
	if command -v "black" > /dev/null; then \
		$(BLACK) --diff --check examples/ && \
		$(BLACK) --diff --check lib/streamlit/ --exclude=/*_pb2.py$/ && \
		$(BLACK) --diff --check lib/tests/ && \
		$(BLACK) --diff --check e2e/scripts/ ; \
	fi

.PHONY: pyformat
# Fix Python files that are not properly formatted.
pyformat:
	pre-commit run black --all-files
	pre-commit run isort --all-files

.PHONY: pytest
# Run Python unit tests.
pytest:
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			--junitxml=test-reports/pytest/junit.xml \
			-l tests/ \
			$(PYTHON_MODULES)

.PHONY: mypy
# Run Mypy static type checker.
mypy:
	./scripts/mypy

.PHONY: integration-tests
# Run all our e2e tests in "bare" mode and check for non-zero exit codes.
integration-tests:
	python3 scripts/run_bare_integration_tests.py

.PHONY: cli-smoke-tests
# Verify that CLI boots as expected when called with `python -m streamlit`
cli-smoke-tests:
	python3 scripts/cli_smoke_tests.py

.PHONY: cli-regression-tests
# Verify that CLI boots as expected when called with `python -m streamlit`
cli-regression-tests: install
	pytest scripts/cli_regression_tests.py

.PHONY: install
# Install Streamlit into your Python environment.
install:
	cd lib ; python setup.py install

.PHONY: develop
# Install Streamlit as links in your Python environment, pointing to local workspace.
develop:
	cd lib; \
		pipenv install --skip-lock

.PHONY: distribution
# Create Python distribution files in dist/.
distribution:
	# Get rid of the old build and dist folders to make sure that we clean old js and css.
	rm -rfv lib/build lib/dist
	cd lib ; python3 setup.py bdist_wheel --universal sdist

.PHONY: package
# Build lib and frontend, and then run 'distribution'.
package: mini-devel frontend distribution

.PHONY: conda-distribution
# Create conda distribution files in lib/conda-recipe/dist.
conda-distribution:
	rm -rf lib/conda-recipe/dist
	mkdir lib/conda-recipe/dist
	# This can take upwards of 20 minutes to complete in a fresh conda installation! (Dependency solving is slow.)
	# NOTE: Running the following command requires both conda and conda-build to
	# be installed.
	ST_CONDA_BUILD=1 GIT_HASH=$$(git rev-parse --short HEAD) conda build lib/conda-recipe --output-folder lib/conda-recipe/dist

.PHONY: conda-package
# Build lib and frontend, and then run 'conda-distribution'
conda-package: mini-devel frontend conda-distribution


.PHONY: clean
# Remove all generated files.
clean:
	cd lib; rm -rf build dist  .eggs *.egg-info
	rm -rf lib/conda-recipe/dist
	find . -name '*.pyc' -type f -delete || true
	find . -name __pycache__ -type d -delete || true
	find . -name .pytest_cache -exec rm -rfv {} \; || true
	rm -rf .mypy_cache
	rm -f lib/streamlit/proto/*_pb2.py*
	rm -rf lib/streamlit/static
	rm -f lib/Pipfile.lock
	rm -rf frontend/build
	rm -rf frontend/node_modules
	rm -rf frontend/test_results
	rm -f frontend/src/autogen/proto.js
	rm -f frontend/src/autogen/proto.d.ts
	rm -rf frontend/public/reports
	rm -rf ~/.cache/pre-commit
	find . -name .streamlit -type d -exec rm -rfv {} \; || true
	cd lib; rm -rf .coverage .coverage\.*

.PHONY: protobuf
# Recompile Protobufs for Python and the frontend.
protobuf:
	@# Python protobuf generation
	if ! command -v protoc &> /dev/null ; then \
		echo "protoc not installed."; \
		exit 1; \
	fi
	protoc_version=$$(protoc --version | cut -d ' ' -f 2);
	protobuf_version=$$(pip show protobuf | grep Version | cut -d " " -f 2-);
ifndef CIRCLECI
			if [[ "$${protoc_version%.*.*}" != "$${protobuf_version%.*.*}" ]] ; then \
				echo -e '\033[31m WARNING: Protoc and protobuf version mismatch \033[0m'; \
				echo "To avoid compatibility issues, please ensure that the protoc version matches the protobuf version you have installed."; \
				echo "protoc version: $${protoc_version}"; \
				echo "protobuf version: $${protobuf_version}"; \
				echo -n "Do you want to continue anyway? [y/N] " && read ans && [ $${ans:-N} = y ]; \
			fi
else
		if [[ "$${protoc_version%.*.*}" != "$${protobuf_version%.*.*}" ]] ; then \
				echo -e '\033[31m WARNING: Protoc and protobuf version mismatch \033[0m'; \
				echo "To avoid compatibility issues, please ensure that the protoc version matches the protobuf version you have installed."; \
				echo "protoc version: $${protoc_version}"; \
				echo "protobuf version: $${protobuf_version}"; \
				echo "Since we're on CI we try to continue anyway..."; \
		fi
endif
	protoc \
		--proto_path=proto \
		--python_out=lib \
		--mypy_out=lib \
		proto/streamlit/proto/*.proto

	@# Create a folder for autogenerated files
	mkdir -p frontend/src/autogen

	@# JS protobuf generation. The --es6 flag generates a proper es6 module.
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		yarn --silent pbjs \
			../proto/streamlit/proto/*.proto \
			-t static-module --wrap es6 \
	) > ./src/autogen/proto.js

	@# Typescript type declarations for our generated protobufs
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		yarn --silent pbts ./src/autogen/proto.js \
	) > ./src/autogen/proto.d.ts

.PHONY: react-init
react-init:
	cd frontend/ ; yarn install --frozen-lockfile

.PHONY: react-build
react-build:
	cd frontend/ ; yarn run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/build/ lib/streamlit/static/

.PHONY: jslint
# Lint the JS code
jslint:
	@# max-warnings 0 means we'll exit with a non-zero status on any lint warning
ifndef CIRCLECI
	cd frontend; \
		yarn lint;
else
	cd frontend; \
		yarn lint \
			--format junit \
			--output-file test-reports/eslint/eslint.xml \
			./src
endif #CIRCLECI

.PHONY: tstypecheck
# Type check the JS/TS code
tstypecheck:
	pre-commit run typecheck --all-files

.PHONY: jsformat
# Fix formatting issues in our JavaScript & TypeScript files.
jsformat:
	pre-commit run prettier --all-files

.PHONY: jstest
# Run JS unit tests.
jstest:
ifndef CIRCLECI
	cd frontend; yarn run test
else
	# Previously we used --runInBand here, which just completely turns off parallelization.
	# But since our CircleCI instance has 2 CPUs, use maxWorkers instead:
	# https://jestjs.io/docs/troubleshooting#tests-are-extremely-slow-on-docker-andor-continuous-integration-ci-server
	cd frontend; yarn run test --maxWorkers=2
endif

.PHONY: jscoverage
# Run JS unit tests and generate a coverage report.
jscoverage:
	cd frontend; yarn run test --coverage --watchAll=false

.PHONY: e2etest
# Run E2E tests.
e2etest:
	./scripts/run_e2e_tests.py

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
		yarn licenses generate-disclaimer --silent --production > ../NOTICES
	# NOTE: This file may need to be manually edited. Look at the Git diff and
	# the parts that should be edited will be obvious.

	./scripts/append_license.sh frontend/src/assets/font/Source_Code_Pro/Source-Code-Pro.LICENSE
	./scripts/append_license.sh frontend/src/assets/font/Source_Sans_Pro/Source-Sans-Pro.LICENSE
	./scripts/append_license.sh frontend/src/assets/font/Source_Serif_Pro/Source-Serif-Pro.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Material-Icons.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Noto-Emoji-Font.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Open-Iconic.LICENSE

.PHONY: headers
# Update the license header on all source files.
headers:
	pre-commit run insert-license --all-files
	pre-commit run license-headers --all-files

.PHONY: build-test-env
# Build docker image that mirrors circleci
build-test-env:
	if ! command -v node &> /dev/null ; then \
		echo "node not installed."; \
		exit 1; \
	fi
	if [[ ! -f lib/streamlit/proto/Common_pb2.py ]]; then \
		echo "Proto files not generated."; \
		exit 1; \
	fi
ifndef CIRCLECI
	docker build \
		--build-arg UID=$$(id -u) \
		--build-arg GID=$$(id -g) \
		--build-arg OSTYPE=$$(uname) \
		--build-arg NODE_VERSION=$$(node --version) \
		-t streamlit_e2e_tests \
		-f e2e/Dockerfile \
		.
else
	docker build \
		--build-arg UID=$$(id -u) \
		--build-arg GID=$$(id -g) \
		--build-arg OSTYPE=$$(uname) \
		--build-arg NODE_VERSION=$$(node --version) \
		-t streamlit_e2e_tests \
		-f e2e/Dockerfile \
		--progress plain \
		.
endif #CIRCLECI

.PHONY: run-test-env
# Run test env image with volume mounts
run-test-env:
	./e2e/run_compose.py

.PHONY: connect-test-env
# Connect to an already-running test env container
connect-test-env:
	docker exec -it streamlit_e2e_tests /bin/bash

.PHONY: pre-commit-install
pre-commit-install:
	pre-commit install
