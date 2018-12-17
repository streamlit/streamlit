# Docker images with streamlit installed from git.

This is used for development.

## Build docker images
```
$ docker-compose build
```

## List images
```
$ docker images | grep -i devel-${USER}
streamlit/streamlit   2.7-devel-armando     cc146558d0ce        11 minutes ago       548MB
```

## Extract wheel files from docker images
You can extract the wheel files from this docker image and upload it to pypi
```
rm -rf /tmp/release
docker run --rm --name streamlit2.7 -d streamlit/streamlit:2.7-devel-armando sleep 20 ; docker cp streamlit2.7:/st/. /tmp/release/
ls -la /tmp/release
```
