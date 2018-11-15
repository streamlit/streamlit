#######################################################################
# Frontend image
#######################################################################
# We need to "mount" the frontend image so we can extract the built
# static contents and include in the proxy.
FROM st/frontend as frontend

#######################################################################
# Proxy build
#######################################################################
FROM python:2-slim-stretch as build

RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales protobuf-compiler

# See lib/.dockerignore because only some of the directory is copied.
COPY lib/. /st/
COPY protobuf/. /protobuf/

# Create protobufs.
RUN protoc --proto_path=/protobuf /protobuf/*.proto --python_out=/st/streamlit/protobuf

# Copy the frontend static content from the frontend image.
COPY --from=frontend /frontend/. /st/streamlit/static/

WORKDIR /st

# Build the wheel file.
RUN python setup.py bdist_wheel --universal


#######################################################################
# Proxy container
#######################################################################
FROM python:2-slim-stretch

# build-essential shouldnt be needed but for some reason one of the pip
# dependencies compiles something so thats why its there.  This image
# size is not ideal.
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales

COPY --from=build /st/dist/streamlit*.whl /st/
COPY lib/entrypoint.sh /

WORKDIR /st
RUN pip install *.whl

ENTRYPOINT /entrypoint.sh
