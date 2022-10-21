#!/bin/bash -e

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

PORT=${PORT:-8501}
IP=${IP:-null}

mkdir -p ~/.streamlit

# Create a streamlit config
cat >~/.streamlit/config.yaml <<EOF
client:
  # Whether Streamlit should remotely record usage stats
  gatherUsageStats: false

# Enable development configuration.  Without these two lines, docker
# logs won't output anything.
development: true
log_level: debug

server:
  # IP address of the machine where the Streamlit Proxy is running.
  externalIP: ${IP}

  # Is the proxy running remotely.
  headless: true
  runOnSave: false
  port: ${PORT}
EOF

python -m streamlit.proxy
