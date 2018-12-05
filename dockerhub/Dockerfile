ARG PYTHON_VERSION

FROM python:$PYTHON_VERSION-slim-stretch
ARG STREAMLIT_VERSION
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install streamlit==$STREAMLIT_VERSION
RUN apt-get remove --purge -y build-essential
