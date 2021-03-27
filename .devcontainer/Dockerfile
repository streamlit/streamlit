# NOTE:
# * Compiling pandas inside of this Docker container will require you to change from the default of 4gb -> 6gb of RAM in Docker for Mac.

FROM arm64v8/python:3.8-slim

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

# Most of the below is taken from https://github.com/microsoft/vscode-dev-containers/tree/master/containers/python-3-miniconda/.devcontainer
# ...we're just starting from an aarch64 base image

# [Option] Install zsh
ARG INSTALL_ZSH="true"
# [Option] Upgrade OS packages to their latest versions
ARG UPGRADE_PACKAGES="true"

# Install needed packages and setup non-root user. Use a separate RUN statement to add your own dependencies.
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID
COPY .devcontainer/library-scripts/common-debian.sh /tmp/library-scripts/
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    # Remove imagemagick due to https://security-tracker.debian.org/tracker/CVE-2019-10131
    && apt-get purge -y imagemagick imagemagick-6-common \
    # Install common packages, non-root user
    && bash /tmp/library-scripts/common-debian.sh "${INSTALL_ZSH}" "${USERNAME}" "${USER_UID}" "${USER_GID}" "${UPGRADE_PACKAGES}" \
    && apt-get install -y --no-install-recommends make build-essential \
    libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev \
    xz-utils tk-dev libffi-dev liblzma-dev python-openssl unixodbc-dev \
    graphviz python3-distutils protobuf-compiler libgconf-2-4 \
    && apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/* /tmp/library-scripts

# Install Node.js
ARG INSTALL_NODE="true"
ARG NODE_VERSION="none"
ENV NVM_DIR=/usr/local/share/nvm
ENV NVM_SYMLINK_CURRENT=true \
    PATH=${NVM_DIR}/current/bin:${PATH}
COPY .devcontainer/library-scripts/node-debian.sh /tmp/library-scripts/
RUN if [ "$INSTALL_NODE" = "true" ]; then bash /tmp/library-scripts/node-debian.sh "${NVM_DIR}" "${NODE_VERSION}" "${USERNAME}"; fi \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/* /tmp/library-scripts

USER vscode

# Install poetry & build
RUN cd lib \
# TODO: md5 check
    && curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python -
    && echo "source $HOME/.poetry/env" >> ~/.bashrc \
    && poetry shell
    && poetry install
    && cd .. \
    && make mini-devel