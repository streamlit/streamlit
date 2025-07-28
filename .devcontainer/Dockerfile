# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

FROM mcr.microsoft.com/devcontainers/python:3.12

ENV PYTHONUNBUFFERED=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    rsync \
    unzip \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash - \
&& apt-get install -y nodejs

# Enable corepack
RUN corepack enable

# Update pip
RUN pip install --upgrade pip
