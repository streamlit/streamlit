#!/bin/bash -e

PORT=${PORT:-8501}
IP=${IP:-null}

mkdir -p ~/.streamlit

# Create a streamlit config
cat >~/.streamlit/config.yaml <<EOF
client:
  # Whether Streamlit should remotely record usage stats
  remotelyTrackUsage: false

# Enable development configuration.  Without these two lines, docker
# logs won't output anything.
development: true
log_level: debug

proxy:
  # IP address of the machine where the Streamlit Proxy is running.
  externalIP: ${IP}

  # Is the proxy running remotely.
  isRemote: true
  watchFileSystem: false
  port: ${PORT}
  useNode: false
EOF

python -m streamlit.proxy
