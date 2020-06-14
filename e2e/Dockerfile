FROM circleci/python:3.7.4-stretch

SHELL ["/bin/bash", "-c"]
ENV PYTHONUNBUFFERED 1

ARG USER=circleci
ARG HOME=/home/$USER
ARG APP=$HOME/repo

# create `yarn start` cache directory
# run before setting the user (https://github.com/docker/compose/issues/3270)
RUN mkdir -p $APP/frontend/node_modules/.cache/hard-source \
    && chown $USER:$USER $APP/frontend/node_modules/.cache/hard-source

USER $USER
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
ARG NODE_VERSION=v10.16.3

# install node and yarn
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION --lts=dubnium \
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

# copy pipfile
COPY --chown=$USER lib/Pipfile.locks/python-3.7.4 ./lib/Pipfile.locks/
COPY --chown=$USER lib/Pipfile ./lib/

# install python modules
RUN source venv/bin/activate && make pipenv-lock CIRCLECI=true

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
