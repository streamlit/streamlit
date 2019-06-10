# Docker images with streamlit installed from git.

This is used for development.

## Build docker images
```
$ (cd backend; docker-compose build)
```

### Frontend errors
* You'll most likely get an error like the following due to memory issues.

![docs/images/docker_build_error.png](docs/images/docker_build_error.png)

* Go to Docker -> Preferences -> Advanced

![docs/images/docker_preferences.png](docs/images/docker_preferences.png)

* The default has 2 GB of memory

![docs/images/docker_advanced_defaults.png](docs/images/docker_advanced_defaults.png)

* I increased it to 8.

![docs/images/docker_advanced_8.png](docs/images/docker_advanced_8.png)

## Run
```
$ (cd backend; docker-compose up streamlit)
```

Manually go to [http://127.0.0.1:8501](http://127.0.0.1:8501)

## Pick a different script

Edit [backend/docker-compose.override.yml](backend/docker-compose.override.yml) and change the `command` line.
