# Makefile for the streamlet shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

# Files for the javascript library.
JS_SRC_PATH = client/src
JS_SRC_FILES = $(shell find $(JS_SRC_PATH) -iname '*.js' -or -iname '*.css')
JS_LIB_PATH = client/lib

# Files for the protobuf libraries.
PROTOBUF_SRC_FILES = protobuf/*.proto
PROTOBUF_BUNDLE_JS = client/lib/protobuf/streamlet.js
PROTOBUF_BUNDLE_PYTHON = server/protobuf/Element_pb2.py

#####################
# USAGE INFORMATION #
#####################

help:
	@echo "Usage:"
	@echo "                                                          "
	@echo "  make <cmd>                                              "
	@echo "                                                          "
	@echo "Where <cmd> is one of:                                    "
	@echo "                                                          "
	@echo "help                    - Print this help message.        "
	@echo "all                     - Build all JS and Python libs.   "
	@echo "clean                   - Remove all js libs.             "
	@echo "js-lib                  - The shared javascript library.  "
	@echo "protobuf-lib            - The shared javascript library.  "
	@echo "                                                          "

###################
# OTHER FUNCTIONS #
###################

all: js-lib protobuf-lib

clean:
	rm -rfv $(JS_LIB_PATH)

# Make the javascript library
js-lib: $(JS_SRC_FILES)
	# Compile javascript files.
	npm --prefix=client/ run build

	# Copy over .css files.
	rsync -arvm --include="*/" --include="*.css" --exclude="*" \
		client/src/ client/lib/

# Makes all the generate protobuf codes.
protobuf-lib: $(PROTOBUF_BUNDLE_JS) $(PROTOBUF_BUNDLE_PYTHON)

# Python javascript implementation uses protoc.
$(PROTOBUF_BUNDLE_PYTHON): $(PROTOBUF_SRC_FILES)
	protoc --proto_path=protobuf $(PROTOBUF_SRC_FILES) \
		--python_out=server/protobuf

# Javascript protobuf implementation uses pbjs.
$(PROTOBUF_BUNDLE_JS): $(PROTOBUF_SRC_FILES)
	pbjs $(PROTOBUF_SRC_FILES) -t static-module -w es6 > $(PROTOBUF_BUNDLE_JS)
