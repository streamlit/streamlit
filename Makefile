# Black magic to get module directories
modules := $(foreach initpy, $(foreach dir, $(wildcard *), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

help:
	@echo "Streamlit Make Commands:"
	@echo " init     - Run once to install python and js dependencies."
	@echo " protobuf - Recompile Protobufs for Python and Javascript."
	@echo " develop  - Install streamlit pointing to local workspace."
	@echo " install  - Install streamlit pointing to PYTHONPATH."
	@echo " wheel    - Create a wheel file in dist/."
	@echo " loc      - Count lines of code."

.PHONY: init
init: setup requirements react-init protobuf # react-build release

setup:
	pip install pip-tools

lib/install_requirements.txt: lib/install_requirements.in
	pip-compile lib/install_requirements.in

lib/requirements.txt: lib/requirements.in lib/install_requirements.txt
	pip-compile lib/requirements.in

requirements: lib/requirements.txt lib/install_requirements.txt
	pip install -r lib/requirements.txt

lint:
	# linting
	flake8 $(modules) tests/

test:
	# testing + code coverage
	PYTHONPATH=. pytest -v -l --doctest-modules $(foreach dir,$(modules),--cov=$(dir)) --cov-report=term-missing tests/ $(modules)

install:
	python setup.py install

develop:
	cd lib ; python setup.py develop

# dev:
# 	python setup.py egg_info --tag-build=.$(USER) bdist_wheel sdist
# 	@echo
# 	@echo Dev wheel file in $(shell ls dist/*$(shell python setup.py --version).$(USER)-py27*whl) and install with '"pip install [wheel file]"'
# 	@echo

wheel:
	python setup.py bdist_wheel sdist
	@echo wheel file in dist/
	@echo
	@echo Release wheel file in $(shell ls dist/*$(shell python setup.py --version)-py27*whl) and install with '"pip install [wheel file]"'
	@echo

clean:
	@echo FIXME: This needs to be fixed!
	# rm -rf build dist  .eggs *.egg-info
	# find . -name '*.pyc' -type f -delete
	# find . -name __pycache__ -type d -delete
	# find . -name .pytest_cache -exec rm -rf {} \;
	# (cd frontend; rm -rf client/build client/node_modules streamlit/lib streamlit/coverage streamlit/node_modules)
	# rm -rf streamlit/static
	# find . -name .streamlit -type d -exec rm -rf {} \;
	# rm -rf .coverage*

.PHONY: protobuf
protobuf:
	protoc --proto_path=protobuf protobuf/*.proto --python_out=lib/streamlit/protobuf
	cd frontend/client; ./node_modules/protobufjs/bin/pbjs ../../protobuf/*.proto -t static-module > ./src/protobuf.js

.PHONY: react-init
react-init:
	# cd frontend/streamlit; npm install
	cd frontend/client; npm install
	# ln -fs ../../streamlit frontend/client/node_modules/streamlit

.PHONY: react-build
react-build:
	rsync -arvm --include="*/" --include="*.css" --exclude="*" frontend/streamlit/src/ frontend/streamlit/lib/
	cd frontend/streamlit; npm run build
	cd frontend/client; npm run build
	rsync -av frontend/client/build/ streamlit/static/

js-lint:
	(cd frontend/streamlit; ./node_modules/.bin/eslint src)

js-test:
	(cd frontend/streamlit; npm run test)
	(cd frontend/streamlit; npm run coverage)


# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/protobuf)|(dist\/)" | \
		xargs wc

# Distributes the package to PyPi
#distribute:
#	cd dist ; python setup.py sdist
#	cd dist ; python setup.py bdist_wheel
#	cd dist ; twine upload dist/*
