FROM python:3.7.3-slim-stretch
ENV PYTHONUNBUFFERED 1

# Install make and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales protobuf-compiler \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip install streamlit==0.43.0

ENTRYPOINT ["streamlit", "run"]
