.PHONY: build push pull aws

STREAMLIT_VERSION := 0.43.1

build:
	STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose build

push:
	STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose push

pull:
	STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose pull

aws: pull
	STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose up -d

down:
	STREAMLIT_VERSION=$(STREAMLIT_VERSION) docker-compose down
