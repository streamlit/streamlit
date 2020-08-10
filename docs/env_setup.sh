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

#duplicates make process for SASS-like variable substitution
mkdir –p ./_static/css
/home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/${READTHEDOCS_VERSION}/bin/python replace_vars.py ./css/custom.css ./_static/css/custom.css

#re-run setup.py build process to make protobuf available
#this is tremendously fragile, as ../lib is hardcoded in here
/home/docs/checkouts/readthedocs.org/user_builds/streamlit-streamlit/envs/${READTHEDOCS_VERSION}/bin/python -m pip install --upgrade --upgrade-strategy eager --no-cache-dir ../lib
