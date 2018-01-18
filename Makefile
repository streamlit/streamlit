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

clean:
	rm -fv $(protobuf_bundle_js) tiny_notebook/protobuf/*_pb2.py
