ARG PYTHON_VERSION=2.7

#######################################################################
# Frontend image
#######################################################################
FROM node:carbon-slim as frontend

# frontend/.dockerignore is what ignores node_modules
COPY frontend/. /frontend/
COPY protobuf/. /protobuf/

WORKDIR /frontend

# Install packages
RUN npm install

# Create protobuf.js
RUN ./node_modules/protobufjs/bin/pbjs ../protobuf/*.proto -t static-module > ./src/protobuf.js

# Build static content which puts it into frontend/build
RUN npm run build

# Get rid of map files.
RUN find /frontend -type 'f' -iname '*.map' -exec rm -f {} \;

#######################################################################
# Proxy build
#######################################################################
FROM python:${PYTHON_VERSION}-slim-stretch as build
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales protobuf-compiler

# See lib/.dockerignore because only some of the directory is copied.
COPY lib/. /st/
COPY protobuf/. /protobuf/

# Create protobufs.
RUN protoc --proto_path=/protobuf /protobuf/*.proto --python_out=/st/streamlit/protobuf

# Copy the frontend static content from the frontend image.
COPY --from=frontend /frontend/build/. /st/streamlit/static/

WORKDIR /st

# Build the wheel file.
RUN python setup.py bdist_wheel --universal


#######################################################################
# Proxy container
#######################################################################
FROM python:${PYTHON_VERSION}-slim-stretch
ENV PYTHONUNBUFFERED 1

# build-essential shouldnt be needed but for some reason one of the pip
# dependencies compiles something so thats why its there.  This image
# size is not ideal.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential

COPY --from=build /st/dist/streamlit*.whl /st/
COPY lib/entrypoint.sh /

WORKDIR /st
RUN pip install *.whl
