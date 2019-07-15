FROM python:3.7.3-slim-stretch
ENV PYTHONUNBUFFERED 1

# Install make and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales protobuf-compiler \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip3 install setuptools wheel

# Install Streamlit
ARG STREAMLIT_VERSION
RUN pip3 install streamlit==${STREAMLIT_VERSION}

COPY credentials.toml config.toml /root/.streamlit/

ENTRYPOINT ["streamlit", "run"]
