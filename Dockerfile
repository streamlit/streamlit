# TODO mount snapshots directory so we can update them

FROM circleci/python:3.7.4-stretch

SHELL ["/bin/bash", "-c"]

ENV PYTHONUNBUFFERED 1

USER circleci

ARG HOME=/home/circleci
# ARG BASH_ENV=/etc/bash.bashrc

WORKDIR ${HOME}/repo

# update apt repository
RUN echo "deb http://ppa.launchpad.net/maarten-fonville/protobuf/ubuntu trusty main" | sudo tee /etc/apt/sources.list.d/protobuf.list
RUN sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 4DEA8909DC6A13A3

# install dependencies
RUN sudo apt-get update && sudo apt-get install -y \
    make graphviz gnupg protobuf-compiler \
    xvfb libgtk2.0-0 libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2

# install node
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
# RUN export NVM_DIR=${HOME}/.nvm
# RUN source ${HOME}/.nvm/nvm.sh
# RUN sudo echo 'export NVM_DIR="$HOME/.nvm"' >> /etc/bash.bashrc
# RUN sudo echo 'source "${HOME}/.nvm/nvm.sh"' >> /etc/bash.bashrc
RUN source "${HOME}/.nvm/nvm.sh" && nvm install --lts=dubnium
RUN source "${HOME}/.nvm/nvm.sh" && npm install -g yarn

# copy package.json
COPY frontend/package.json frontend/yarn.lock ./frontend/
# TODO fix permission denied on `yarn install`
RUN sudo chmod 777 ./frontend

# install node modules
# RUN make react-init
RUN source "${HOME}/.nvm/nvm.sh" && cd frontend && yarn install --frozen-lockfile

# install virtual env
RUN sudo python -m venv venv
RUN source venv/bin/activate
# RUN make setup
RUN sudo pip install pip-tools pipenv

# copy pipfile
COPY lib/Pipfile.locks/python-3.7.4 ./lib/Pipfile.lock
COPY lib/Pipfile ./lib/Pipfile

# install python modules
# RUN make pipenv-lock
RUN cd lib && sudo pipenv install --ignore-pipfile --dev --system
RUN source venv/bin/activate && deactivate
RUN source venv/bin/activate

# register streamlit user
RUN mkdir ${HOME}/.streamlit && \
    echo '[general]' >  ${HOME}/.streamlit/credentials.toml && \
    echo 'email = "jonathan@streamlit.io"' >> ${HOME}/.streamlit/credentials.toml

# copy app (or mount?)
COPY . .

# build
RUN sudo make develop

EXPOSE 3000

# cypress
CMD source "${HOME}/.nvm/nvm.sh" && cd frontend && yarn run cy:serve-and-run-all
