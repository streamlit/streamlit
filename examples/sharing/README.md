# Streamlit app on AWS nvidia-docker

This isn't for Streamlit users but for Streamlit Developers. There's no
way for a streamlit user to use this at the moment. This setup is to
learn what is required and what needs to be built

## Build docker images

```
make build
```

## Push image to dockerhub

```
make push
```

## Push to production

### VPN in.

[https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#use-vpn](https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#use-vpn])

```
$ sudo /usr/local/sbin/openvpn --config /path/to/user.ovpn
```

### Setup SSH tunnel

[https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#create-ssh-tunnel](https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#create-ssh-tunnel)

```
$ ssh ubuntu@aws02.streamlit.io -L127.0.0.1:2374:/var/run/docker.sock -fN
```

### Set DOCKER_HOST

[https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#run-containers-in-aws](https://github.com/streamlit/streamlit/wiki/Running-Streamlit-on-Docker-on-EC2#run-containers-in-aws)

```
$ exporrt DOCKER_HOST=tcp://127.0.0.1:2374
```

### Pull down images from dockerhub

```
$ make pull
```

### Launch

```
$ make aws
STREAMLIT_VERSION=0.43.1 docker-compose pull
Pulling benchmark     ... done
Pulling benchmark-gpu ... done
STREAMLIT_VERSION=0.43.1 docker-compose up -d
WARNING: The Docker Engine you're using is running in swarm mode.

Compose does not use swarm mode to deploy services to multiple nodes in a swarm. All containers will be scheduled on the current node.

To deploy your application across the swarm, use `docker stack deploy`.

Creating network "sharing_default" with the default driver
Creating sharing_benchmark-gpu_1 ... done
Creating sharing_benchmark_1     ... done
```

## View internally

Ports from [docker-compose.yml](docker-compose.yml)

- [benchmark](http://aws02.streamlit.io:5699)
- [benchmark-gpu](http://aws02.streamlit.io:5698)

## View externally

TODO(armando): Write ELB Instructions

## Bring down.

```
$ make down
STREAMLIT_VERSION=0.43.1 docker-compose down
Stopping sharing_benchmark_1     ... done
Stopping sharing_benchmark-gpu_1 ... done
Removing sharing_benchmark_1     ... done
Removing sharing_benchmark-gpu_1 ... done
Removing network sharing_default
```
