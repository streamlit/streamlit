# Makefile for the streamlit shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

STREAMLIT_SHARED_LOCAL_LIB = local/client/node_modules/streamlit-shared
# JS_SRC_FILES = $(shell find $(JS_SRC_PATH) -iname '*.js' -or -iname '*.css')
# JS_LIB_PATH = client/lib

#####################
# USAGE INFORMATION #
#####################

help:
	@echo "Usage:"
	@echo "                                                               "
	@echo "  make <cmd>                                                   "
	@echo "                                                               "
	@echo "Where <cmd> is one of:                                         "
	@echo "                                                               "
	@echo "help                    - Print this help message.             "
	@echo "clean                   - Remove all js libs.                  "
	@echo "init                    - Intialize repo (DO AFTER INSTALLING)."
	@echo "all                     - Build JS Python, and Protobuf libs.  "
	@echo "js-lib                  - The shared javascript library.       "
	@echo "protobuf-lib            - The protobuf libraries.              "
	@echo "production              - Create a production build.           "
	@echo "package                 - Package up the python distribution.  "
	@echo "distribute              - Upload the package to PyPy           "
	@echo "                                                               "

###################
# OTHER FUNCTIONS #
###################

all:
	cd shared ; make all

production: all
	cd local/client ; npm run build
# data stored in /Users/adrien/Desktop/streamlit-cloud/local/client/build

js-lib:
	cd shared ; make js-lib

protobuf-lib:
	cd shared ; make protobuf-lib

# Cleans out generated files.
clean:
	cd shared; make clean

	# Clean up the distribution folder.
	rm -rfv dist/streamlit/*

init:
	pip install -r requirements.txt
	cd shared ; make init
	cd local/client ; npm install
	test -e $(STREAMLIT_SHARED_LOCAL_LIB) || ln -sv ../../../shared/client $(STREAMLIT_SHARED_LOCAL_LIB)

# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/protobuf)|(dist\/)" | \
		xargs wc

# Makes a distribution for PIP installation.
package:
	rsync -avL --exclude="__pycache__" local/server/streamlit dist/
	rsync -av local/client/build dist/
	cp -v config.yaml requirements.txt dist/

# Distributes the package to PyPi
distribute:
	cd dist ; python setup.py sdist
	cd dist ; python setup.py bdist_wheel
	cd dist ; twine upload dist/*
