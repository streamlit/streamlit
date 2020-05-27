#RZ, 20200512: This file duplicates some of the functionality from the core `make all-devel`
#This is because we cannot assume we have sudo capaibilities or modify the RTD Docker container
#https://github.com/streamlit/streamlit/pull/1435#discussion_r423826910


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

#re-run setup.py build process to make protobuf available
#this is tremendously fragile, as ../lib is hardcoded in here, and testing presence of environment directories
if [ -d "/home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/latest" ]
then
  /home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/latest/bin/python -m pip install --upgrade --upgrade-strategy eager --no-cache-dir ../lib
else
  /home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/stable/bin/python -m pip install --upgrade --upgrade-strategy eager --no-cache-dir ../lib
fi
