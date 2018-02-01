protobuf_sources = protobuf/*.proto
protobuf_bundle_js = web-client/src/protobuf/printf.js
protobuf_bundle_python = tiny_notebook/protobuf/Element_pb2.py

# Makes all the generate protobuf codes.
all: $(protobuf_bundle_python) $(protobuf_bundle_js)

# Python javascript implementation uses protoc.
$(protobuf_bundle_python): $(protobuf_sources)
	protoc --proto_path=protobuf $(protobuf_sources) \
		--python_out=tiny_notebook/protobuf

# Javascript protobuf implementation uses pbjs.
$(protobuf_bundle_js): $(protobuf_sources)
	pbjs $(protobuf_sources) -t static-module -w es6 > $(protobuf_bundle_js)

# Cleans out generated files.
clean:
	rm -fv $(protobuf_bundle_js) tiny_notebook/protobuf/*_pb2.py

# Counts the number of lines of code in the project
loc:
	find tiny_notebook web-client/src protobuf \
		-iname '*.py' -or -iname '*.js' -or -iname '*.proto' | \
		egrep -v "(_pb2)|(printf\.js)|(registerServiceWorker)" | \
		xargs wc

# Initializes the repository. DO THIS AFTER CHECKING OUT!
init:
	# See: https://docs.npmjs.com/cli/link
	echo 'Creating a global link to streamlet-shared.'
	pushd shared/client/
	npm link
	popd

	echo 'Locally linking web-client to streamlet-shared.'
	pushd web-client/
	npm link streamlet-shared
	popd
