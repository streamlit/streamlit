# Black magic to get module directories
modules := $(foreach initpy, $(foreach dir, $(wildcard *), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

.PHONY: all
all: setup requirements.txt requirements react-init protobuf

setup:
	pip install pip-tools

requirements.txt: requirements.in
	pip-compile requirements.in

requirements: requirements.txt
	pip install -r requirements.txt

install:
	python setup.py install

develop:
	python setup.py develop

dev:
	python setup.py egg_info --tag-build=.$(USER) bdist_wheel
	@echo
	@echo Dev wheel file in $(shell ls dist/*$(shell python setup.py --version).$(USER)-py27*whl) and install with '"pip install [wheel file]"'
	@echo

release:
	python setup.py bdist_wheel
	@echo wheel file in dist/
	@echo
	@echo Release wheel file in $(shell ls dist/*$(shell python setup.py --version)-py27*whl) and install with '"pip install [wheel file]"'
	@echo

clean:
	rm -rf build dist  .eggs *.egg-info
	find . -name '*.pyc' -type f -delete
	find . -name __pycache__ -type d -delete
	(cd frontend; rm -rf client/build client/node_modules streamlit/lib streamlit/node_modules)

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
