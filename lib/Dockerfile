FROM backend_frontend as frontend
FROM backend_protobuf as protobuf

FROM python:3.7.3-slim-stretch
ENV PYTHONUNBUFFERED 1

# Install make and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils apt-transport-https curl ca-certificates \
    build-essential locales protobuf-compiler \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip install pip-tools pipenv
COPY bin/. /streamlit/bin/
COPY setup.py Pipfile MANIFEST.in README.md /streamlit/
COPY Pipfile.locks/python-3.7.3 /streamlit/Pipfile.lock

WORKDIR /streamlit
RUN pipenv install --ignore-pipfile --system --dev

# Generate protobufs
COPY --from=protobuf protobuf/. /protobuf/
RUN mkdir -p /streamlit/streamlit/protobuf && protoc --proto_path=/protobuf /protobuf/*.proto --python_out=/streamlit/streamlit/protobuf

# Copy the frontend static content from the frontend image.
COPY --from=frontend frontend/. /streamlit/streamlit/static/

# Copy code.
COPY streamlit/. /streamlit/streamlit/

# Setup development
RUN python setup.py develop
