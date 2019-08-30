FROM circleci/python:3.7.4-stretch

SHELL ["/bin/bash", "-c"]
ENV PYTHONUNBUFFERED 1

USER circleci
ARG HOME=/home/circleci

WORKDIR $HOME/repo
RUN sudo chown circleci $HOME/repo

# update apt repository
RUN echo "deb http://ppa.launchpad.net/maarten-fonville/protobuf/ubuntu trusty main" | sudo tee /etc/apt/sources.list.d/protobuf.list
RUN sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 4DEA8909DC6A13A3

# install dependencies
RUN sudo apt-get update && sudo apt-get install -y \
    make graphviz gnupg protobuf-compiler \
    xvfb libgtk2.0-0 libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2

# install nvm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash

# node vars
ARG NVM_DIR=$HOME/.nvm
ARG NODE_VERSION=v10.16.3

# install yarn
RUN source $NVM_DIR/nvm.sh && \
    nvm install --lts=dubnium && \
    npm install -g yarn

# node path
ENV NODE_PATH $NVM_DIR/$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH

# install virtual env
RUN python -m venv venv
# RUN source venv/bin/activate && make setup
RUN source venv/bin/activate && pip install pip-tools pipenv

# python path
ENV PATH $HOME/repo/venv/bin:$PATH

# copy package.json
COPY --chown=circleci frontend/package.json frontend/yarn.lock ./frontend/

# install node modules
# TODO store nvm cache in volume so install is shorter
# RUN make react-init
RUN cd frontend && yarn install --frozen-lockfile

# copy pipfile
COPY --chown=circleci lib/Pipfile.locks/python-3.7.4 ./lib/Pipfile.lock
COPY --chown=circleci lib/Pipfile ./lib/Pipfile

# install python modules
# RUN source venv/bin/activate && make pipenv-lock CIRCLECI=true
RUN source venv/bin/activate && cd lib && pipenv install --ignore-pipfile --dev --system

# TODO mount snapshots directory so we can update them
COPY --chown=circleci . .

# install streamlit
RUN make develop

# register streamlit user
RUN mkdir $HOME/.streamlit && \
    echo '[general]' >  $HOME/.streamlit/credentials.toml && \
    echo 'email = "jonathan@streamlit.io"' >> $HOME/.streamlit/credentials.toml

EXPOSE 3000

# cypress
# TODO store yarn start cache in volume so install is shorter
#CMD cd frontend && \
#    NODE_OPTIONS=--max_old_space_size=4096 yarn start-server-and-test start http://localhost:3000 \
#    "../scripts/run_e2e_tests.sh -a true -c .."

# cache node modules and virtualenv in a volume
#VOLUME /home/circleci/.cache
#VOLUME /home/circleci/repo/venv

CMD /bin/bash
