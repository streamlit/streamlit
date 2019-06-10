FROM backend_protobuf as protobuf

#######################################################################
# Frontend Build
#######################################################################
# The frontend build image has a lot of stuff thats not required for
# serving static content but is required to build the static content.
# st/frontend         latest              033f590e481a        2 minutes ago       217MB <-- frontend
# <none>              <none>              1255147956f8        3 minutes ago       508MB <-- build

FROM node:dubnium-slim as build

RUN apt-get update && apt-get install -y --no-install-recommends \
    make git \
    && rm -rf /var/lib/apt/lists/*

COPY craco.config.js .eslintrc.js package.json tsconfig.json yarn.lock /frontend/

WORKDIR /frontend

# Install packages
RUN yarn install

# Create protobuf.js
COPY --from=protobuf /protobuf/. /protobuf/
RUN mkdir -p src/autogen
RUN ./node_modules/protobufjs/bin/pbjs ../protobuf/*.proto -t static-module --es6 > ./src/autogen/protobuf.js
RUN ./node_modules/protobufjs/bin/pbts ./src/autogen/protobuf.js> ./src/autogen/protobuf.d.ts

# Copy source files
COPY public/. public/
COPY scripts/. scripts/
COPY src/. src/

# Build static content which puts it into frontend/build
RUN NODE_OPTIONS=--max_old_space_size=4096 yarn run build


# Get rid of map files.
RUN find /frontend -type 'f' -iname '*.map' -exec rm -f {} \;

########################################################################
## Frontend Container
########################################################################
FROM node:dubnium-slim

# Copy the built static content from the temporary frontend build image
COPY --from=build /frontend/build/. /frontend

ENTRYPOINT ["/bin/sh"]
