# Makefile for the streamlet shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

STREAMLET_SHARED_LOCAL_LIB = local/client/node_modules/streamlet-shared
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
	@echo "all                     - Build JS Python, and Protobuf libs.  "
	@echo "js-lib                  - The shared javascript library.       "
	@echo "clean                   - Remove all js libs.                  "
	@echo "init                    - Intialize repo (DO AFTER INSTALLING)."
	@echo "                                                               "

###################
# OTHER FUNCTIONS #
###################

all:
	cd shared ; make all

js-lib:
	cd shared ; make js-lib

# Cleans out generated files.
clean:
	cd shared; make clean

init:
	pip install -r requirements.txt
	cd shared ; make init
	cd local/client ; npm install
	ln -Fsv ../../../shared/client $(STREAMLET_SHARED_LOCAL_LIB)

# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/protobuf)" | \
		xargs wc
