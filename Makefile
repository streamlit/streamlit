# Black magic to get module directories
modules := $(foreach initpy, $(foreach dir, $(wildcard lib/*), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

help:
	@echo "Streamlit Make Commands:"
	@echo " init         - Run once to install python and js dependencies."
	@echo " build        - build the static version of Streamlit (without Node)"
	@echo " protobuf     - Recompile Protobufs for Python and Javascript."
	@echo " develop      - Install streamlit pointing to local workspace."
	@echo " install      - Install streamlit pointing to PYTHONPATH."
	@echo " wheel        - Create a wheel file in dist/."
	@echo " loc          - Count lines of code."
	@echo " site         - Builds the site at /site/public."
	@echo " devel-site   - Starts the dev server for the site."
	@echo " publish-site - Builds and pushes the site to prod."

.PHONY: init
init: setup requirements react-init protobuf # react-build release

.PHONY: build
build: react-build

setup:
	pip install pip-tools

# NOTE: Got rid of these next two steps because pip-compile is too strict about
# versions.

# lib/install_requirements.txt: lib/install_requirements.in
# 	pip-compile lib/install_requirements.in

# lib/requirements.txt: lib/requirements.in lib/install_requirements.txt
# 	pip-compile lib/requirements.in

requirements: lib/requirements.txt lib/install_requirements.txt
	pip install -r lib/requirements.txt

pylint:
	# Linting
	# (Ignore E402 since our Python2-compatibility imports break this lint rule.)
	cd lib; flake8 --ignore=E402 --exclude=streamlit/protobuf/*_pb2.py $(modules) tests/

pytest:
	# Just testing. No code coverage.
	cd lib; PYTHONPATH=. pytest -v -l --doctest-modules tests/ $(modules)

pycoverage:
	# testing + code coverage
	cd lib; PYTHONPATH=. pytest -v -l --doctest-modules $(foreach dir,$(modules),--cov=$(dir)) --cov-report=term-missing tests/ $(modules)

install:
	cd lib ; python setup.py install

develop:
	cd lib ; python setup.py develop

# dev:
# 	python setup.py egg_info --tag-build=.$(USER) bdist_wheel sdist
# 	@echo
# 	@echo Dev wheel file in $(shell ls dist/*$(shell python setup.py --version).$(USER)-py27*whl) and install with '"pip install [wheel file]"'
# 	@echo

wheel:
	# Get rid of the old build folder to make sure that we delete old js and css.
	rm -rfv lib/build
	cd lib ; python setup.py bdist_wheel --universal
	# cd lib ; python setup.py bdist_wheel sdist

clean:
	@echo FIXME: This needs to be fixed!
	cd lib; rm -rf build dist  .eggs *.egg-info
	find . -name '*.pyc' -type f -delete || true
	find . -name __pycache__ -type d -delete || true
	find . -name .pytest_cache -exec rm -rfv {} \; || true
	cd frontend; rm -rf build node_modules
	rm -f lib/streamlit/protobuf/*_pb2.py
	rm -f frontend/src/protobuf.js
	rm -rf lib/streamlit/static
	find . -name .streamlit -type d -exec rm -rfv {} \; || true
	cd lib; rm -rf .coverage .coverage\.*

.PHONY: site
site:
	cd site; hugo

.PHONY: site
devel-site:
	cd site; hugo server -D

.PHONY: publish-site
publish-site:
	cd site; hugo
	cd site; aws s3 sync --acl public-read public s3://streamlit.io/ --profile streamlit

.PHONY: protobuf
protobuf:
	protoc --proto_path=protobuf protobuf/*.proto --python_out=lib/streamlit/protobuf
	cd frontend/ ; ( \
		echo "/* eslint-disable */" ; \
		echo ; \
		./node_modules/protobufjs/bin/pbjs ../protobuf/*.proto -t static-module \
	) > ./src/protobuf.js

.PHONY: react-init
react-init:
	cd frontend/ ; npm install

.PHONY: react-build
react-build:
	cd frontend/ ; npm run build
	rsync -av --delete --delete-excluded --exclude=reports \
		frontend/build/ lib/streamlit/static/
	find lib/streamlit/static -type 'f' -iname '*.map' | xargs rm -fv

js-lint:
	cd frontend; ./node_modules/.bin/eslint src

js-test:
	cd frontend; npm run test
	cd frontend; npm run coverage


# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/protobuf)|(dist\/)" | \
		xargs wc

# Distributes the package to PyPi
distribute:
	cd lib/dist ; ls -t *.whl | head -n 1 | xargs twine upload
