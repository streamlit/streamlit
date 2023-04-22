# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM circleci/python:3.7.11

SHELL ["/bin/bash", "-o", "pipefail", "-e", "-u", "-x", "-c"]
ENV PYTHONUNBUFFERED 1

# For the container running cypress to be able to write snapshots to a
# directory mounted from the host, the UID/GID of the user in the container
# must be UIDs/GIDs with write permissions on the host. We set these arguments
# by the make targets conventionally used to work with this image.
ARG UID
ARG GID

# MacOS handles GroupIDs differently than Linux, so we don't have to run
# `groupadd` on non-Linux system (more precisely, on MacOS since we haven't
# even tried building this image on Windows).
ARG OSTYPE=Linux

ARG USER=circleci
ARG HOME=/home/$USER
ARG APP=$HOME/repo

# DOCKER Variable is used to detect in Makefile wheter we are building E2E docker image,
# which uses Python 3.7, in which we need to skip --use-deprecated=legacy-resolver flag
ARG DOCKER=true

USER root

RUN usermod -u $UID $USER
RUN bash -c 'if [ ${OSTYPE} == Linux ]; then groupmod -g ${GID} ${USER}; fi'

USER $USER

WORKDIR $APP
RUN sudo chown $USER $APP

# update apt repository
RUN echo "deb http://ppa.launchpad.net/maarten-fonville/protobuf/ubuntu trusty main" \
    | sudo tee /etc/apt/sources.list.d/protobuf.list \
    && sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 4DEA8909DC6A13A3

# install dependencies
RUN sudo apt-get update \
    && sudo apt-get install -y --no-install-recommends \
        apt-transport-https \
        apt-utils \
    && sudo apt-get install -y \
        fonts-noto-color-emoji \
        gnupg \
        graphviz \
        libasound2 \
        libgconf-2-4 \
        libgtk2.0-0 \
        libnotify-dev \
        libnss3 \
        libxss1 \
        make \
        protobuf-compiler \
        unixodbc-dev \
        xvfb \
    && sudo apt-get autoremove -yqq --purge \
    && sudo apt-get clean \
    && sudo rm -rf /var/lib/apt/lists/*

# install nvm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.35.2/install.sh | bash

# node vars
ARG NVM_DIR=$HOME/.nvm
ARG NODE_VERSION

# install node and yarn
RUN set +x  \
    && source $NVM_DIR/nvm.sh \
    && set -x \
    && nvm install $NODE_VERSION \
    && npm install -g yarn

# node path
ENV NODE_PATH $NVM_DIR/$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH

# install virtual env
RUN python -m venv venv \
    && source venv/bin/activate

# python path
ENV PATH $APP/venv/bin:$PATH
ENV VIRTUAL_ENV=$APP/venv

# Copy files required to install NodeJS and Python dependencies
COPY --chown=$USER Makefile .
COPY --chown=$USER scripts/should_install_tensorflow.py scripts/

# install node modules
COPY --chown=$USER frontend/package.json frontend/yarn.lock ./frontend/
RUN make react-init

# install python dependencies
COPY --chown=$USER lib/setup.py ./lib/
COPY --chown=$USER lib/bin/streamlit.cmd ./lib/bin/
COPY --chown=$USER lib/dev-requirements.txt ./lib/
COPY --chown=$USER lib/test-requirements.txt ./lib/

ARG INSTALL_DEV_REQS="true"
ARG INSTALL_TEST_REQS="false"

RUN IS_DOCKER=true make python-init

# copy streamlit code
COPY --chown=$USER . .

# install streamlit
RUN make develop

# register streamlit user
RUN mkdir $HOME/.streamlit \
    && echo '[general]' >  $HOME/.streamlit/credentials.toml \
    && echo 'email = "test@streamlit.io"' >> $HOME/.streamlit/credentials.toml

# register mapbox token
RUN MAPBOX_TOKEN=$(curl -sS https://data.streamlit.io/tokens.json | jq -r '.["mapbox-localhost"]') \
    && echo '[mapbox]' >  ~/.streamlit/config.toml \
    && echo 'token = "'$MAPBOX_TOKEN'"' >> ~/.streamlit/config.toml

CMD /bin/bash
