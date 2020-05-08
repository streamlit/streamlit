#whole script assumes you start in docs/


#get protoc pre-compiled binary, unzip
wget https://github.com/protocolbuffers/protobuf/releases/download/v3.11.4/protoc-3.11.4-linux-x86_64.zip
unzip protoc-3.11.4-linux-x86_64.zip

#build protobufs
./bin/protoc \
    --proto_path=../proto \
	--python_out=../lib \
    --mypy_out=../lib \
	../proto/streamlit/proto/*.proto

#ls -ltrh ../lib/streamlit/proto

#re-run build process to make protobuf available
/home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/latest/bin/python -m pip install --upgrade --upgrade-strategy eager --no-cache-dir ../lib