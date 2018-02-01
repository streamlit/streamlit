# Makefile for the streamlet shared javascript, css, and python libraries.
# Run `make help` for options, or `make all` to build the library.

###################
# BUILD VARIABLES #
###################

JS_SRC_PATH = client/src
JS_SRC_FILES = $(shell find $(JS_SRC_PATH) -iname '*.js' -or -iname '*.css')
JS_LIB_PATH = client/lib

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
	@echo "streamlet-shared-js-lib - The shared javascript library.  "
	@echo "                                                          "

###################
# OTHER FUNCTIONS #
###################

all: streamlet-shared-js-lib

clean:
	rm -rfv $(JS_LIB_PATH)

# Make the javascript library
streamlet-shared-js-lib: $(JS_SRC_FILES)
	# Compile javascript files.
	npm --prefix=client/ run build

	# Copy over .css files.
	rsync -arvm --include="*/" --include="*.css" --exclude="*" \
		client/src/ client/lib/
