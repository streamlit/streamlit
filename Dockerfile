FROM circleci/python:3.7.4-stretch

SHELL ["/bin/bash", "-c"]

ENV PYTHONUNBUFFERED 1

USER circleci

ARG HOME=/home/circleci

WORKDIR ${HOME}/repo

RUN sudo chown circleci ${HOME}/repo

# update apt repository
RUN echo "deb http://ppa.launchpad.net/maarten-fonville/protobuf/ubuntu trusty main" | sudo tee /etc/apt/sources.list.d/protobuf.list
RUN sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 4DEA8909DC6A13A3

# install dependencies
RUN sudo apt-get update && sudo apt-get install -y \
    make graphviz gnupg protobuf-compiler \
    xvfb libgtk2.0-0 libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2

# install node
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
# RUN sudo echo 'export NVM_DIR="$HOME/.nvm"' >> /etc/bash.bashrc
# RUN sudo echo 'source "${HOME}/.nvm/nvm.sh"' >> /etc/bash.bashrc
RUN source "${HOME}/.nvm/nvm.sh" && nvm install --lts=dubnium
RUN source "${HOME}/.nvm/nvm.sh" && npm install -g yarn

# copy package.json
COPY --chown=circleci frontend/package.json frontend/yarn.lock ./frontend/

# install node modules
# RUN make react-init
# TODO store nvm cache in volume so install is shorter
RUN source "${HOME}/.nvm/nvm.sh" && cd frontend && yarn install --frozen-lockfile

# install virtual env
# RUN mkdir ${HOME}/venv && chown circleci ${HOME}/venv
RUN python -m venv venv
# RUN make setup
RUN source venv/bin/activate && pip install pip-tools pipenv

# copy pipfile
COPY --chown=circleci lib/Pipfile.locks/python-3.7.4 ./lib/Pipfile.lock
COPY --chown=circleci lib/Pipfile ./lib/Pipfile

# install python modules
# RUN make pipenv-lock
RUN source venv/bin/activate && cd lib && pipenv install --ignore-pipfile --dev --system

# register streamlit user
RUN mkdir ${HOME}/.streamlit && \
    echo '[general]' >  ${HOME}/.streamlit/credentials.toml && \
    echo 'email = "jonathan@streamlit.io"' >> ${HOME}/.streamlit/credentials.toml

# TODO mount snapshots directory so we can update them
COPY --chown=circleci . .

# build
RUN source venv/bin/activate && make develop

EXPOSE 3000

ENV PATH="${HOME}/repo/venv/bin:$PATH"

# cypress
# TODO store yarn start cache in volume so install is shorter
CMD source "${HOME}/.nvm/nvm.sh" && cd frontend && \
    NODE_OPTIONS=--max_old_space_size=4096 yarn start-server-and-test start http://localhost:3000 \
    "../scripts/run_e2e_tests.sh -a true -c .."
