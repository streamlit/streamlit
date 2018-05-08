# Black magic to get module directories
modules := $(foreach initpy, $(foreach dir, $(wildcard *), $(wildcard $(dir)/__init__.py)), $(realpath $(dir $(initpy))))

.PHONY: all
all: setup requirements.txt requirements protobuf

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

.PHONY: protobuf
protobuf:
	protoc --proto_path=streamlit/protobuf streamlit/protobuf/*.proto --python_out=streamlit/protobuf
