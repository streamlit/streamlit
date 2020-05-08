#get protoc pre-compiled binary, unzip
wget https://github.com/protocolbuffers/protobuf/releases/download/v3.11.4/protoc-3.11.4-linux-x86_64.zip
unzip protoc-3.11.4-linux-x86_64.zip

#assumes you are in docs/
./bin/protoc \
    --proto_path=../proto \
	--python_out=../lib \
	../proto/streamlit/proto/*.proto

ls ../lib/streamlit/proto