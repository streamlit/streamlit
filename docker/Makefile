.PHONY: build push aws

STREAMLIT_VERSION := 0.44.0

#######################################################################
# Build
#######################################################################
build:
	cd aws; STREAMLIT_VERSION=$(STREAMLIT_VERSION) DOCKER_TLS_VERIFY= DOCKER_HOST=unix:///var/run/docker.sock docker-compose build

#######################################################################
# Push
#######################################################################
push:
	./push.sh

#######################################################################
# Pull
#######################################################################
pull:
	cd aws; STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose pull

#######################################################################
# Run
#######################################################################
aws:
	cd aws; STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose up -d
