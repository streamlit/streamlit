# Black magic to get module directories
modules := $(foreach initpy, $(foreach dir, $(wildcard *), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

.PHONY: all
all: setup install_requirements.txt requirements.txt requirements react-init protobuf react-build release

setup:
	pip install pip-tools

install_requirements.txt: install_requirements.in
	pip-compile install_requirements.in

requirements.txt: requirements.in install_requirements.txt
	pip-compile requirements.in

requirements: requirements.txt install_requirements.txt
	pip install -r requirements.txt

lint:
	# linting
	flake8 $(modules) tests/

test:
	# testing + code coverage
	PYTHONPATH=. pytest -v -l --doctest-modules $(foreach dir,$(modules),--cov=$(dir)) --cov-report=term-missing tests/ $(modules)

install:
	python setup.py install

develop:
	python setup.py develop

dev:
	python setup.py egg_info --tag-build=.$(USER) bdist_wheel sdist
	@echo
	@echo Dev wheel file in $(shell ls dist/*$(shell python setup.py --version).$(USER)-py27*whl) and install with '"pip install [wheel file]"'
	@echo

release:
	python setup.py bdist_wheel sdist
	@echo wheel file in dist/
	@echo
	@echo Release wheel file in $(shell ls dist/*$(shell python setup.py --version)-py27*whl) and install with '"pip install [wheel file]"'
	@echo

clean:
	rm -rf build dist  .eggs *.egg-info
	find . -name '*.pyc' -type f -delete
	find . -name __pycache__ -type d -delete
	find . -name .pytest_cache -exec rm -rf {} \;
	(cd frontend; rm -rf client/build client/node_modules streamlit/lib streamlit/coverage streamlit/node_modules)
	rm -rf streamlit/static
	find . -name .streamlit -type d -exec rm -rf {} \;
	rm -rf .coverage*

.PHONY: protobuf
protobuf:
	protoc --proto_path=streamlit/protobuf streamlit/protobuf/*.proto --python_out=streamlit/protobuf
	(cd frontend/streamlit; mkdir -p ./lib/protobuf; ./node_modules/protobufjs/bin/pbjs ../../streamlit/protobuf/*.proto -t static-module > ./lib/protobuf/streamlit.js)

.PHONY: react-init
react-init:
	(cd frontend/streamlit; npm install)
	(cd frontend/client; npm install)
	ln -fs ../../streamlit frontend/client/node_modules/streamlit

.PHONY: react-build
react-build:
	rsync -arvm --include="*/" --include="*.css" --exclude="*" frontend/streamlit/src/ frontend/streamlit/lib/
	(cd frontend/streamlit; npm run build)
	(cd frontend/client; npm run build)
	rsync -av frontend/client/build/ streamlit/static/

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
