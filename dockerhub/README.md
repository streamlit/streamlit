# Instructions for pushing official streamlit docker images.

The difference between this directory `dockerhub` and `docker` is that
dockerhub builds an image with streamlit that is fetched from pypi ie
installed via `pip install`

The `docker` directory builds an docker image from the git repo and
those images are only used for development.

## Login
```
$ docker login
Login with your Docker ID to push and pull images from Docker Hub. If you don't have a Docker ID, head over to https://hub.docker.com to create one.
Username: aajst
Password:
Login Succeeded
```

## Build Streamlit 2.7, 3.5, 3.6 Images
```
$ STREAMLIT_VERSION=0.20.0 docker-compose build
Building streamlit-27
Step 1/7 : ARG PYTHON_VERSION
Step 2/7 : FROM python:$PYTHON_VERSION-slim-stretch
 ---> 0dc3d8d47241
Step 3/7 : ARG STREAMLIT_VERSION
 ---> Using cache
 ---> 92c4ba97bd08
Step 4/7 : ENV PYTHONUNBUFFERED 1
 ---> Using cache
 ---> c5a845961c58
Step 5/7 : RUN apt-get update && apt-get install -y --no-install-recommends     build-essential curl     && rm -rf /var/lib/apt/lists/*
 ---> Using cache
 ---> fc94fcb2b50e
Step 6/7 : RUN pip install streamlit==$STREAMLIT_VERSION
 ---> Using cache
 ---> 520685f7c14d
Step 7/7 : RUN apt-get remove --purge -y build-essential curl
 ---> Using cache
 ---> 3f9dcf13fd8c

Successfully built 3f9dcf13fd8c
Successfully tagged streamlit/streamlit:27-0.20.0
Building streamlit-35
Step 1/7 : ARG PYTHON_VERSION
Step 2/7 : FROM python:$PYTHON_VERSION-slim-stretch
 ---> fd9b04312bfd
Step 3/7 : ARG STREAMLIT_VERSION
 ---> Using cache
 ---> 30f64de16ad6
Step 4/7 : ENV PYTHONUNBUFFERED 1
 ---> Using cache
 ---> 3274eee2cd90
Step 5/7 : RUN apt-get update && apt-get install -y --no-install-recommends     build-essential curl     && rm -rf /var/lib/apt/lists/*
 ---> Using cache
 ---> ff9ece575f34
Step 6/7 : RUN pip install streamlit==$STREAMLIT_VERSION
 ---> Using cache
 ---> a31348ff9425
Step 7/7 : RUN apt-get remove --purge -y build-essential curl
 ---> Using cache
 ---> eac1124c1e00

Successfully built eac1124c1e00
Successfully tagged streamlit/streamlit:35-0.20.0
Building streamlit-36
Step 1/7 : ARG PYTHON_VERSION
Step 2/7 : FROM python:$PYTHON_VERSION-slim-stretch
 ---> ea57895cf3f9
Step 3/7 : ARG STREAMLIT_VERSION
 ---> Using cache
 ---> 310f069543b1
Step 4/7 : ENV PYTHONUNBUFFERED 1
 ---> Using cache
 ---> 40e78802ef6f
Step 5/7 : RUN apt-get update && apt-get install -y --no-install-recommends     build-essential curl     && rm -rf /var/lib/apt/lists/*
 ---> Using cache
 ---> 6fc9f32e81bc
Step 6/7 : RUN pip install streamlit==$STREAMLIT_VERSION
 ---> Using cache
 ---> c7e338da3a26
Step 7/7 : RUN apt-get remove --purge -y build-essential curl
 ---> Using cache
 ---> 6df6842aee04

Successfully built 6df6842aee04
Successfully tagged streamlit/streamlit:36-0.20.0
```

## Build keras tensorflow versions
```
$ STREAMLIT_VERSION=0.20.0 docker-compose -f docker-compose.yml -f docker-compose.keras_tf.yml build
Step 3/6 : FROM streamlit/streamlit:$PYTHON_VERSION-$STREAMLIT_VERSION
 ---> 36a5114cc1bf
Step 4/6 : ENV PYTHONUNBUFFERED 1
 ---> Running in 6722ef8c258f
Removing intermediate container 6722ef8c258f
 ---> 1c6dc052a220
Step 5/6 : RUN pip install keras==2.1.4 tensorflow==1.12.0
 ---> Running in 4f51c7dd7663
Collecting keras==2.1.4
  Downloading https://files.pythonhosted.org/packages/86/45/a273fe3f8fe931a11da34fba1cb74013cfc70dcf93e5d8d329c951dc44c5/Keras-2.1.4-py2.py3-none-any.whl (322kB)
Collecting tensorflow==1.12.0
  Downloading https://files.pythonhosted.org/packages/b1/ad/48395de38c1e07bab85fc3bbec045e11ae49c02a4db0100463dd96031947/tensorflow-1.12.0-cp35-cp35m-manylinux1_x86_64.whl (83.1MB)
Requirement already satisfied: pyyaml in /usr/local/lib/python3.5/site-packages (from keras==2.1.4) (3.13)
Collecting scipy>=0.14 (from keras==2.1.4)
  Downloading https://files.pythonhosted.org/packages/cd/32/5196b64476bd41d596a8aba43506e2403e019c90e1a3dfc21d51b83db5a6/scipy-1.1.0-cp35-cp35m-manylinux1_x86_64.whl (33.1MB)
```

## Find images
```
$ docker images|grep -i streamlit
streamlit/streamlit   2.7-0.20.0-keras-tf   6946ddbd777b        About a minute ago   1.18GB
streamlit/streamlit   3.6-0.20.0-keras-tf   19214a9b9bdf        About a minute ago   1.19GB
streamlit/streamlit   3.5-0.20.0-keras-tf   ba3f269b646f        2 minutes ago        1.2GB
streamlit/streamlit   2.7-0.20.0            90437a8fab80        3 minutes ago        540MB
streamlit/streamlit   3.6-0.20.0            b6dfc0afd646        4 minutes ago        553MB
streamlit/streamlit   3.5-0.20.0            36a5114cc1bf        4 minutes ago        553MB

```

## Upload images
```
$ ./push.sh 0.20.0
The push refers to repository [docker.io/streamlit/streamlit]
06a4498ffbdb: Pushed
670d09bed0fb: Pushed
9a0f48e527ea: Pushed
6cffeea81e5d: Layer already exists
614a79865f6d: Layer already exists
612d27bb923f: Layer already exists
ef68f6734aa4: Layer already exists
2.7-0.20.0: digest: sha256:c1959acac8bf82b6bd0f2063323f098bc9b3e55deb9893f46ce016deb05d7c4c size: 1797
```

## Verify
Go to streamlit dockerhub [page](https://hub.docker.com/r/streamlit/streamlit/tags/)

## Logout
```
$ docker logout
Removing login credentials for https://index.docker.io/v1/
```
