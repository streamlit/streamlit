# Make uses /bin/sh by default, but we are using some bash features.  On Ubuntu
# /bin/sh is POSIX compliant, ie it's not bash.  So let's be explicit:
SHELL=/bin/bash

# Black magic to get module directories
PYTHON_MODULES := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))
PY_VERSION := $(shell python -c 'import platform; print(platform.python_version())')

# Configure Black to support only syntax supported by the minimum supported Python version in setup.py.
BLACK=black --target-version=py36


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
all-devel: init develop
	@echo ""
	@echo "    The frontend has *not* been rebuilt."
	@echo "    If you need to make a wheel file or test S3 sharing, run:"
	@echo ""
	@echo "    make frontend"
	@echo ""

.PHONY: mini-devel
# Get minimal dependencies and install Streamlit into Python environment -- but do not build the frontend.
mini-devel: mini-init develop

.PHONY: init
# Install all Python and JS dependencies.
init: setup pipenv-install react-init scssvars protobuf

.PHONY: mini-init
# Install minimal Python and JS dependencies for development.
mini-init: setup pipenv-dev-install react-init scssvars protobuf

.PHONY: frontend
# Build frontend into static files.
frontend: react-build

.PHONY: setup
setup:
	pip install pip-tools pipenv ; \
	if [[ $(PY_VERSION) == "3.6.0" || $(PY_VERSION) > "3.6.0" ]]; then \
		pip install black; \
	fi

.PHONY: pipenv-install
pipenv-install: pipenv-dev-install pipenv-test-install

.PHONY: pipenv-dev-install
pipenv-dev-install: lib/Pipfile
	# Run pipenv install; don't update the Pipfile.lock.
	# We use `--sequential` here to ensure our results are...
	# "more deterministic", per pipenv's documentation.
	# (Omitting this flag is causing incorrect dependency version
	# resolution on CircleCI.)
	cd lib; \
		pipenv install --dev --skip-lock --sequential

.PHONY: pipenv-test-install
pipenv-test-install: lib/test-requirements.txt
	cd lib; \
		pip install -r test-requirements.txt

.PHONY: pylint
# Run "black", our Python formatter, to verify that our source files
# are properly formatted. Does not modify any files. Returns with a non-zero
# status if anything is not properly formatted. (This isn't really
# "linting"; we're not checking anything but code style.)
pylint:
	@# Black requires Python 3.6+ to run (but you can reformat
	@# Python 2 code with it, too).
	if command -v "black" > /dev/null; then \
		$(BLACK) --check docs/ ; \
		$(BLACK) --check examples/ ; \
		$(BLACK) --check lib/streamlit/ --exclude=/*_pb2.py$/ ; \
		$(BLACK) --check lib/tests/ ; \
		$(BLACK) --check e2e/scripts/ ; \
	fi

.PHONY: pyformat
# Run "black", our Python formatter, to fix any source files that are not
# properly formatted.
pyformat:
	@# Black requires Python 3.6+ to run (but you can reformat
	@# Python 2 code with it, too).
	if command -v "black" > /dev/null; then \
		$(BLACK) docs/ ; \
		$(BLACK) examples/ ; \
		$(BLACK) lib/streamlit/ --exclude=/*_pb2.py$/ ; \
		$(BLACK) lib/tests/ ; \
		$(BLACK) e2e/scripts/ ; \
	fi

.PHONY: pytest
# Run Python unit tests.
pytest:
	# Just testing. No code coverage.
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			--junitxml=test-reports/pytest/junit.xml \
			-l tests/ \
			$(PYTHON_MODULES)

.PHONY: pycoverage
# Show Python test coverage.
pycoverage:
	# testing + code coverage
	cd lib; \
		PYTHONPATH=. \
		pytest -v \
			--junitxml=test-reports/pytest/junit.xml \
			-l $(foreach dir,$(PYTHON_MODULES),--cov=$(dir)) \
			--cov-report=term-missing tests/ \
			$(PYTHON_MODULES)

.PHONY: mypy
# Run Mypy static type checker.
mypy:
	./scripts/mypy

.PHONY: integration-tests
# Run Python integration tests. Currently, this is just a script that runs
# all the e2e tests in "bare" mode and checks for non-zero exit codes.
integration-tests:
	python scripts/run_bare_integration_tests.py

.PHONY: install
# Install Streamlit into your Python environment.
install:
	cd lib ; python setup.py install

.PHONY: develop
# Install Streamlit as links in your Python environemnt, pointing to local workspace.
develop:
	cd lib ; python setup.py develop

.PHONY: wheel
# Create a Python wheel file in dist/.
wheel:
	# Get rid of the old build folder to make sure that we delete old js and css.
	rm -rfv lib/build
	cd lib ; python setup.py bdist_wheel --universal
	# cd lib ; python setup.py bdist_wheel sdist

.PHONY: clean
# Remove all generated files.
clean: clean-docs
	cd lib; rm -rf build dist  .eggs *.egg-info
	find . -name '*.pyc' -type f -delete || true
	find . -name __pycache__ -type d -delete || true
	find . -name .pytest_cache -exec rm -rfv {} \; || true
	rm -rf .mypy_cache
	rm -f lib/streamlit/proto/*_pb2.py*
	rm -rf lib/streamlit/static
	rm -f lib/Pipfile.lock
	rm -rf frontend/build
	rm -rf frontend/node_modules
	rm -f frontend/src/autogen/proto.js
	rm -f frontend/src/autogen/proto.d.ts
	rm -f frontend/src/autogen/scssVariables.ts
	rm -rf frontend/public/reports
	find . -name .streamlit -type d -exec rm -rfv {} \; || true
	cd lib; rm -rf .coverage .coverage\.*

.PHONY: clean-docs
# Remove all generated files from the docs folder.
clean-docs:
	cd docs; \
		make distclean

.PHONY: docs
# Generate HTML documentation at /docs/_build.
docs: clean-docs
	cd docs; \
		make html

.PHONY: devel-docs
# Build docs and start a test server at port 8000.
devel-docs: docs
	cd docs/_build/html; \
		python -m SimpleHTTPServer 8000 || python -m http.server 8000

.PHONY: publish-docs
# Build docs and push to prod.
publish-docs: docs
	cd docs/_build; \
		aws s3 sync \
				--acl public-read html s3://docs.streamlit.io \
				--profile streamlit

	# The line below uses the distribution ID obtained with
	# $ aws cloudfront list-distributions | \
	#     jq '.DistributionList.Items[] | \
	#     select(.Aliases.Items[0] | \
	#     contains("docs.streamlit.io")) | \
	#     .Id'

	aws cloudfront create-invalidation \
		--distribution-id=E16K3UXOWYZ8U7 \
		--paths \
			'/*' \
			'/tutorial/*' \
		--profile streamlit

.PHONY: protobuf
# Recompile Protobufs for Python and Javascript.
protobuf:
	@# Python protobuf generation
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
		./node_modules/protobufjs/bin/pbjs \
			../proto/streamlit/proto/*.proto \
			-t static-module --es6 \
	) > ./src/autogen/proto.js

	@# Typescript type declarations for our generated protobufs
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		./node_modules/protobufjs/bin/pbts ./src/autogen/proto.js \
	) > ./src/autogen/proto.d.ts

.PHONY: react-init
react-init:
	cd frontend/ ; yarn install --frozen-lockfile

.PHONY: react-build
react-build:
	cd frontend/ ; yarn run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/build/ lib/streamlit/static/
	# If you're debugging sharing, you may want to comment this out so that
	# sourcemaps exist.
	find lib/streamlit/static -type 'f' -iname '*.map' | xargs rm -fv

.PHONY: scssvars
# Generate frontend/src/autogen/scssVariables.ts, which has SCSS variables that we can use in TS.
scssvars: react-init
	mkdir -p frontend/src/autogen
	cd frontend ; ( \
		echo "export const SCSS_VARS = " ; \
		yarn run --silent scss-to-json src/assets/css/variables.scss \
	) > src/autogen/scssVariables.ts

.PHONY: jslint
# Lint the JS code. Saves results to test-reports/eslint/eslint.xml.
jslint:
	@# max-warnings 0 means we'll exit with a non-zero status on any lint warning
ifndef CIRCLECI
	cd frontend; \
		./node_modules/.bin/eslint \
			--ext .js \
			--ext .jsx \
			--ext .ts \
			--ext .tsx \
			--ignore-pattern 'src/autogen/*' \
			--max-warnings 0 \
			./src
else
	cd frontend; \
		./node_modules/.bin/eslint \
			--ext .js \
			--ext .jsx \
			--ext .ts \
			--ext .tsx \
			--ignore-pattern 'src/autogen/*' \
			--max-warnings 0 \
			--format junit \
			--output-file test-reports/eslint/eslint.xml \
			./src
endif #CIRCLECI

.PHONY: jsformat
# Runs "Prettier" on our JavaScript and TypeScript code to fix formatting
# issues.
jsformat:
		yarn --cwd "frontend" pretty-quick \
			--pattern "**/*.*(js|jsx|ts|tsx)"

.PHONY: jstest
# Run JS unit tests.
jstest:
ifndef CIRCLECI
	cd frontend; yarn run test
else
	# Use --runInBand on CircleCI, per
	# https://jestjs.io/docs/en/troubleshooting#tests-are-extremely-slow-on-docker-andor-continuous-integration-ci-server
	cd frontend; yarn run test --runInBand
endif

.PHONY: jscoverage
# Run JS unit tests and generate a coverage report
jscoverage:
	cd frontend; yarn run test --coverage --watchAll=false

.PHONY: e2etest
# Run E2E tests.
e2etest:
	./scripts/run_e2e_tests.sh

.PHONY: loc
# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/streamlit\/proto)|(dist\/)" | \
		xargs wc

.PHONY: distribute
# Distributes the package to PyPi
distribute:
	cd lib/dist; \
		twine upload $$(ls -t *.whl | head -n 1)

.PHONY: notices
# Rebuild the NOTICES file.
notices:
	cd frontend; \
		yarn licenses generate-disclaimer --silent --production > ../NOTICES
	# NOTE: This file may need to be manually edited. Look at the Git diff and
	# the parts that should be edited will be obvious.

	./scripts/append_license.sh frontend/src/assets/font/IBM_Plex_Fonts.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Material-Icons.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Noto-Emoji-Font.LICENSE
	./scripts/append_license.sh frontend/src/assets/img/Open-Iconic.LICENSE

.PHONY: headers
# Update the license header on all source files.
headers:
	./scripts/add_license_headers.py \
		lib/streamlit \
		lib/tests \
		e2e/scripts \
		e2e/specs \
		frontend/src \
		frontend/public \
		proto \
		examples \
		scripts

.PHONY: build-circleci
# Build docker image that mirrors circleci
build-circleci:
	docker build -t streamlit_circleci -f e2e/Dockerfile .

.PHONY: run-circleci
# Run circleci image with volume mounts
run-circleci:
	mkdir -p frontend/mochawesome-report
	docker-compose \
		-f e2e/docker-compose.yml \
		run \
		--rm \
		--name streamlit_circleci \
		streamlit

.PHONY: connect-circleci
# Connect to running circleci container
connect-circleci:
	docker exec -it streamlit_circleci /bin/bash

.PHONY: flake8
# Run flake8 and show errors: E9,F63,F7,F82
flake8:
	scripts/flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics --exclude=./frontend,./lib/build
