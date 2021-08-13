FROM circleci/python:3.7.11

SHELL ["/bin/bash", "-c"]
ENV PYTHONUNBUFFERED 1

# For the container running cypress to be able to write snapshots to a
# directory mounted from the host, the UID/GID of the user in the container
# must be UIDs/GIDs with write permissions on the host. We default to the
# user/group IDs for the first non-root user on most linux systems, but in
# practice these should always be explicitly set by the make targets
# conventionally used to work with this image.
ARG UID=1000
ARG GID=1000

# MacOS handles GroupIDs differently than Linux, so we don't have to run
# `groupadd` on non-Linux system (more precisely, on MacOS since we haven't
# even tried building this image on Windows).
ARG OSTYPE=Linux

ARG USER=circleci
ARG HOME=/home/$USER
ARG APP=$HOME/repo

USER root

RUN usermod -u $UID $USER
RUN bash -c 'if [ ${OSTYPE} == Linux ]; then groupmod -g ${GID} ${USER}; fi'

USER $USER

# create `yarn start` cache directory
RUN mkdir -p $APP/frontend/node_modules/.cache/hard-source \
    && chown $USER:$USER $APP/frontend/node_modules/.cache/hard-source

WORKDIR $APP
RUN sudo chown $USER $APP

# update apt repository
RUN echo "deb http://ppa.launchpad.net/maarten-fonville/protobuf/ubuntu trusty main" \
    | sudo tee /etc/apt/sources.list.d/protobuf.list \
    && sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 4DEA8909DC6A13A3

# install dependencies
RUN sudo apt-get update && sudo apt-get install -y \
    make graphviz gnupg protobuf-compiler unixodbc-dev \
    xvfb libgtk2.0-0 libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 \
    && sudo rm -rf /var/lib/apt/lists/*

# install nvm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.35.2/install.sh | bash

# node vars
ARG NVM_DIR=$HOME/.nvm
ARG NODE_VERSION=v14.15.3

# install node and yarn
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION --lts=fermium \
    && npm install -g yarn

# node path
ENV NODE_PATH $NVM_DIR/$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH

# copy makefile
COPY --chown=$USER Makefile .

# install virtual env
RUN python -m venv venv \
    && source venv/bin/activate \
    && make setup

# python path
ENV PATH $APP/venv/bin:$PATH

# copy package.json
COPY --chown=$USER frontend/package.json frontend/yarn.lock ./frontend/

# install node modules
RUN make react-init

# copy Pipfile and test-requirements.txt
COPY --chown=$USER lib/Pipfile ./lib/
COPY --chown=$USER lib/test-requirements.txt ./lib/

# install python modules
RUN source venv/bin/activate && make pipenv-install CIRCLECI=true

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
