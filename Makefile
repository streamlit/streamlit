# Black magic to get module directories
PYTHON_MODULES := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

PY_VERSION := python-$(shell python -c 'import platform; print(platform.python_version())')

.PHONY: help
help:
	@# Magic line used to create self-documenting makefiles.
	@# See https://stackoverflow.com/a/35730928
	@awk '/^#/{c=substr($$0,3);next}c&&/^[[:alpha:]][[:alnum:]_-]+:/{print substr($$1,1,index($$1,":")),c}1{c=0}' Makefile | column -s: -t

.PHONY: all
# Get dependencies, build frontend, install Streamlit into Python environment.
all: init install build develop

.PHONY: all-devel
# Get dependencies and install Streamlit into Python environment -- but do not build the frontend.
all-devel: init install develop
	@echo ""
	@echo "    The frontend has *not* been rebuilt, so shared reports won't work."
	@echo "    If you need to test report sharing, run 'make build' first!"
	@echo ""

.PHONY: init
# Install Python and JS dependencies.
init: setup pipenv-install react-init scssvars protobuf # react-build release

.PHONY: build
# Build frontend into static files.
build: react-build

.PHONY: setup
setup:
	pip install pip-tools pipenv

.PHONY: pipenv-install
pipenv-install: lib/Pipfile
	@# Runs pipenv install; doesn't update the Pipfile.lock.
	cd lib; pipenv install --dev

.PHONY: pipenv-lock
# Re-generate Pipfile.lock. This should be run when you update the Pipfile.
pipenv-lock: lib/Pipfile
	@# Regenerates Pipfile.lock and rebuilds the virtualenv. This is rather slow.
# In CircleCI, dont generate Pipfile.lock This is only used for development.
ifndef CIRCLECI
	cd lib; rm -f Pipfile.lock; pipenv lock --dev && mv Pipfile.lock Pipfile.locks/$(PY_VERSION)
else
	echo "Running in CircleCI, not generating requirements."
endif
	cd lib; rm -f Pipfile.lock; cp -f Pipfile.locks/$(PY_VERSION) Pipfile.lock
ifndef CIRCLECI
	# Dont update lockfile and install whatever is in lock.
	cd lib; pipenv install --ignore-pipfile --dev
else
	cd lib; pipenv install --ignore-pipfile --dev --system
endif

.PHONY: pylint
# Run Python linter.
pylint:
	# Linting
	# (Ignore E402 since our Python2-compatibility imports break this lint rule.)
	cd lib; \
		flake8 \
		--ignore=E402,E128 \
		--exclude=streamlit/proto/*_pb2.py \
		$(PYTHON_MODULES) \
		tests/

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
	cd frontend; rm -rf build node_modules
	rm -f lib/streamlit/proto/*_pb2.py
	rm -rf frontend/public/vendor
	rm -f frontend/src/autogen/proto.js
	rm -f frontend/src/autogen/proto.d.ts
	rm -f frontend/src/autogen/scssVariables.ts
	rm -rf lib/streamlit/static
	rm -f lib/Pipfile.lock
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
				--acl public-read html s3://streamlit.io/secret/docs/ \
				--profile streamlit

	@# The line below uses the distribution ID obtained with
	@# $ aws cloudfront list-distributions | \
	@#     jq '.DistributionList.Items[] | \
	@#     select(.Aliases.Items[0] | \
	@#     contains("www.streamlit.io")) | \
	@#     .Id'

		aws cloudfront create-invalidation \
			--distribution-id=E5G9JPT7IOJDV \
			--paths \
				'/secret/docs/*' \
				'/secret/docs/tutorial/*' \
			--profile streamlit

.PHONY: protobuf
# Recompile Protobufs for Python and Javascript.
protobuf:
	@# Python protobuf generation
	protoc \
		--proto_path=proto \
		--python_out=lib \
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
# Lint the JS code.
jslint:
	@# max-warnings 0 means we'll exit with a non-zero status on any lint warning
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

.PHONY: jstest
# Run JS unit tests.
jstest:
	cd frontend; yarn run test
	cd frontend; yarn run coverage

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

.PHONY: prepare-conda-repo
prepare-conda-repo:
	mkdir -p /var/tmp/streamlit-conda
	aws s3 sync \
			s3://repo.streamlit.io/streamlit-forge/ \
			/var/tmp/streamlit-conda/streamlit-forge/ \
			--profile streamlit

.PHONY: conda-packages
conda-packages:
	cd scripts; \
		./create_conda_packages.sh

.PHONY: serve-conda-packages
serve-conda-packages:
	cd /var/tmp/streamlit-conda; \
		python -m SimpleHTTPServer 8000 || python -m http.server 8000

.PHONY: conda-dev-env
conda-dev-env:
	conda env create -f scripts/conda/test_conda_env.yml

.PHONY: clean-conda-dev-env
clean-conda-dev-env:
	conda env remove -n streamlit-dev

.PHONY: distribute-conda-packages
distribute-conda-packages:
	aws s3 sync \
		/var/tmp/streamlit-conda/streamlit-forge/ \
		s3://repo.streamlit.io/streamlit-forge/ \
		--acl public-read \
		--profile streamlit

	aws cloudfront create-invalidation \
		--distribution-id=E3V3HGGB52ZUA0 \
		--paths '/*' \
		--profile streamlit

.PHONY: notices
# Rebuild the NOTICES file.
notices:
	cd frontend; \
		yarn notices generate-disclaimer --silent --production > ../NOTICES
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
		frontend/src \
		frontend/cypress/integration \
		frontend/public \
		proto \
		examples \
		scripts
