# Makefile for the streamlet shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

# JS_SRC_PATH = client/src
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
	@echo "clean                   - Remove all js libs.                  "
	@echo "init                    - Intialize repo (DO AFTER INSTALLING)."
	@echo "                                                               "

###################
# OTHER FUNCTIONS #
###################

all:
	cd shared ; make all

# Cleans out generated files.
clean:
	rm -fv $(protobuf_bundle_js) tiny_notebook/protobuf/*_pb2.py

init:
	pip install pandas Pillow protobuf PyYAML aiohttp motor
	npm install -g protobufjs
	cd shared ; make init
	cd local/client ; npm install
	ln -sv ../../../shared/client local/client/node_modules/streamlet-shared


# Counts the number of lines of code in the project
loc:
	find . -iname '*.py' -or -iname '*.js'  | \
		egrep -v "(node_modules)|(_pb2)|(lib\/protobuf)" | \
		xargs wc

# # Initializes the repository. DO THIS AFTER CHECKING OUT!
# init:
# 	# Put in a link from the client to the shared libraries.
# 	pushd web-client/node_modules
# 	ln -sv ../../shared/client streamlet_shared
# 	popd
# 	# # See: https://docs.npmjs.com/cli/link
# 	# echo 'Creating a global link to streamlet-shared.'
# 	# pushd shared/client/
# 	# npm link
# 	# popd
#   #
# 	# echo 'Locally linking web-client to streamlet-shared.'
# 	# pushd web-client/
# 	# npm link streamlet-shared
# 	# popd
