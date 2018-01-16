protobuf_source = protobuf/notebook.proto
protobuf_bundle_js = web-client/src/protobuf/notebook.js
protobuf_bundle_python = tiny_notebook/protobuf/notebook_pb2.py

# Makes all the generate protobuf codes.
all: $(protobuf_bundle_python) $(protobuf_bundle_js)

# Python javascript implementation uses protoc.
$(protobuf_bundle_python): $(protobuf_source)
	protoc protobuf/notebook.proto --python_out=tiny_notebook

# Javascript protobuf implementation uses pbjs.
$(protobuf_bundle_js): $(protobuf_source)
	pbjs $(protobuf_source) -t static-module -w es6 > $(protobuf_bundle_js)

clean:
	rm -fv $(protobuf_bundle_js) $(protobuf_bundle_python)
