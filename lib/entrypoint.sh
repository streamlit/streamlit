#!/bin/bash -e

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
