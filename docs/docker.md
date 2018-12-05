# Docker

These are instructions for use by streamlit developers.

## Docker crash course

* The docker engine runs containers.
* The docker cli command with a Dockerfile builds docker images by sending docker 'protobufs' the docker engine.
* The docker cli command tool can start a container with a specific image by sending command 'protobufs to the docker engine.
* docker-compose command takes a docker-compose yaml file, generates the
  docker 'protobufs' and sends it to the docker engine.
* docker-compose is basically all the command line flags from docker cli but in a file
* docker-machine runs the docker engine in a VM.  So you can verify
  that networking works as well as isolation ie not depending on 127.0.0.1
* both docker cli and docker-compose can use either a local docker
  engine or remote docker engine by setting the DOCKER_HOST environment
  variable.

## Install docker

### OSX
```
brew cask install docker
```

### linux
Follow the instructions [here](https://docs.docker.com/install/linux/docker-ce/ubuntu/)
```
$ sudo apt-get install apt-transport-https ca-certificates curl software-properties-common
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
$ sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
$ sudo apt-get update
$ sudo apt-get install docker-ce
```

## Install docker-compose

### OSX
comes preinstalled but you can install via `pip install docker-compose`

### Linux
```
pip install docker-compose
```

## Install docker-machine

### OSX
comes preinstalled

### Linux
Install instructions [here](https://docs.docker.com/machine/install-machine/)

```
base=https://github.com/docker/machine/releases/download/v0.14.0 && \
  curl -L $base/docker-machine-$(uname -s)-$(uname -m) >/tmp/docker-machine && \
  sudo install /tmp/docker-machine /usr/local/bin/docker-machine
```

## Verify docker*

### docker
```
$ docker run --rm -it hello-world
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
d1725b59e92d: Pull complete
Digest: sha256:0add3ace90ecb4adbf7777e9aacf18357296e799f81cabc9fde470971e499788
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.

To try something more ambitious, you can run an Ubuntu container with:
 $ docker run -it ubuntu bash

Share images, automate workflows, and more with a free Docker ID:
 https://hub.docker.com/

For more examples and ideas, visit:
 https://docs.docker.com/get-started/
```

### docker-compose
This will take a while.  As its building python 2.7, 3.5, 3.6
```
$ cd streamlet-cloud/docker/streamlit
$ docker-compose build
...
Removing intermediate container 97fe770f142d
 ---> bdf7675d95dc

Successfully built bdf7675d95dc
Successfully tagged st/streamlit-36:latest
```

You should see these images.
```
$ docker images
REPOSITORY                       TAG                 IMAGE ID            CREATED             SIZE
st/streamlit-36                  latest              bdf7675d95dc        6 minutes ago       608MB
st/streamlit-35                  latest              83e07fc84946        8 minutes ago       609MB
st/proxy                         latest              be1c1febd6e9        10 minutes ago      595MB
st/streamlit-27                  latest              be1c1febd6e9        10 minutes ago      595MB
st/frontend                      latest              b7f569bd16d2        13 minutes ago      218MB
```

Pick an image and run `streamlit version`
```
$ docker run --rm -it st/streamlit-36 /bin/bash
root@afa8cb2c6734:/st# streamlit version
```
Streamlit v0.18.1

### docker-machine
```
$ docker-machine create --driver=virtualbox st0
$ docker-machine env st0
$ eval $(docker-machine env st0)
$ docker run hello-world
```

You can now run all the commands from above but it will be running the docker
engine on the VM instead of locally You can access things via 192.168.99.100
instead of 127.0.0.1 as if it were a real remote machine

```
$ docker-machine env st0
export DOCKER_TLS_VERIFY="1"
export DOCKER_HOST="tcp://192.168.99.100:2376"
export DOCKER_CERT_PATH="/Users/armando/.docker/machine/machines/st0"
export DOCKER_MACHINE_NAME="st0"
# Run this command to configure your shell:
# eval $(docker-machine env st0)
$ eval $(docker-machine env st0)
$ docker run hello-world
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
d1725b59e92d: Pull complete
Digest: sha256:0add3ace90ecb4adbf7777e9aacf18357296e799f81cabc9fde470971e499788
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.

To try something more ambitious, you can run an Ubuntu container with:
 $ docker run -it ubuntu bash

Share images, automate workflows, and more with a free Docker ID:
 https://hub.docker.com/

For more examples and ideas, visit:
 https://docs.docker.com/get-started/
```
