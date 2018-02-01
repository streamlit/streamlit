# Makefile for the streamlet shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

# JS_SRC_PATH = client/src
# JS_SRC_FILES = $(shell find $(JS_SRC_PATH) -iname '*.js' -or -iname '*.css')
# JS_LIB_PATH = client/lib

protobuf_sources = protobuf/*.proto
protobuf_bundle_js = web-client/src/protobuf/printf.js
protobuf_bundle_python = tiny_notebook/protobuf/Element_pb2.py

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
	@echo "protobuf-libs           - The protobuf libraries.              "
	@echo "                                                               "

###################
# OTHER FUNCTIONS #
###################

all: protobuf-libs streamlet-shared

# Cleans out generated files.
clean:
	rm -fv $(protobuf_bundle_js) tiny_notebook/protobuf/*_pb2.py

# Make the shared javascript library.
streamlet-shared:
	pushd	shared ; make streamlet-shared-js-lib ; popd

# Makes all the generate protobuf codes.
protobuf-libs: $(protobuf_bundle_python) $(protobuf_bundle_js)

# Python javascript implementation uses protoc.
$(protobuf_bundle_python): $(protobuf_sources)
	protoc --proto_path=protobuf $(protobuf_sources) \
		--python_out=tiny_notebook/protobuf

# Javascript protobuf implementation uses pbjs.
$(protobuf_bundle_js): $(protobuf_sources)
	pbjs $(protobuf_sources) -t static-module -w es6 > $(protobuf_bundle_js)


# # Counts the number of lines of code in the project
# loc:
# 	find tiny_notebook web-client/src protobuf \
# 		-iname '*.py' -or -iname '*.js' -or -iname '*.proto' | \
# 		egrep -v "(_pb2)|(printf\.js)|(registerServiceWorker)" | \
# 		xargs wc

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
