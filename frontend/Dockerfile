#######################################################################
# Frontend Build
#######################################################################
# The frontend build image has a lot of stuff thats not required for
# serving static content but is required to build the static content.
# st/frontend         latest              033f590e481a        2 minutes ago       217MB <-- frontend
# <none>              <none>              1255147956f8        3 minutes ago       508MB <-- build

FROM node:carbon-slim as build

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
# Frontend Container
#######################################################################
FROM node:carbon-slim

# Install npm package serve to start a web server to literally serve the
# built static contents
RUN npm install -g serve

# Copy the built static content from the temporary frontend build image
COPY --from=build /frontend/build/. /frontend

# By default it listens on port 5000
ENTRYPOINT serve -s /frontend
