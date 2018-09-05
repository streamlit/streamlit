# Contributing to Streamlit

[Streamlit](../README.md) is a stateless alternative to Jupyter notebooks for machine learning and data science. Here we explain how to install and contribute to the Streamlit library itself. **Note:** Users of Streamlit don't need to go through all these steps (only those working on the library itself).

## Installation


#### 1. Install `npm` or `nvm`

###### MacOS

No instructions at present. Please feel free to add your own.

###### On Debian-based Linux

```
sudo apt install npm
```

#### 2. Install Python 3.6 or Later

You may want a [virtual environment](docs/python-virtual-envornment.md).

#### 3. Install the `protobuf` compiler

###### On MacOS
```
brew install protobuf
```
###### On Linux
```
sudo apt-get install protobuf-compiler
```

#### 4. Initialize the Library

To install the Python and Javascxript libraries, compile the Protobufs, run:
```
make init
```
To point `streamlit` into your source tree, run:
```
make develop
```
Test this by running:
```
python -m streamlit
```
and you should see a list of commands.

## Developing Streamlit

#### Ordinary Development Cycle

The basic developer workflow is that you run a `react` development server in the
background which will automatically recompile Javascript and CSS when necessary.

To start the server, open up a new terminal window and run:
```
cd frontend ; npm start
```
Happy coding!

#### When You Change the Python or Javascript Code

Everything should automatically still work. :)

#### When You Update Protobufs

You need to run:
```
make protobuf
```

#### When Change Javascript of Python Dependencies

Rerun:
```
make init
```

#### Testing The Static Saving

Create a bundle with the static files.
```
make build
```
Test that the locally saved example works:
```
open http://localhost:3000/?id=example
```
Then load a page and click the save icon.

## Coding Conventions

Streamlit coding conventions can be found [here](docs/conventions.md).

## Publishing to `PyPi`

#### Write The Release notes

Place them [here](docs/release-notes.md). Then:

#### Make Sure You Don't Have the Proxy Running

Run:

```
streamlit kill_proxy
ps -ef | grep -i python
```
and make sure that none of the lines say `proxy`.

#### Bump the Version Number

**Note:** The current version is `0.15.0`.

Update the version in the following locations:
  - `CONTRIBUTING.md` (*In two places! Above and below*)
  - `lib/setup.py`
  - `frontend/package.json`
  - **Update the proxy port** to `5Mmm` where `M` is the major version number and `mm` is the minor version number. For example for `v0.14` set `proxy.port` to `5014`. _(Updating this number with each version ensures that we don't run into browser caching issues.)_
    - `lib/streamlit/config/config.yaml` : set the `proxy.port`
    - `frontend/src/WebClient.js` : set the `PROXY_PORT`.

Then, so things like `package-lock.json` get updated, run:
```
make init
```

#### Test that Static Loading works

```
open http://localhost:3000/?id=example
```

#### Build Streamlit and Test It Without Node

Build Streamlit so that it can run without the Node development server:
```
make build
```
Test that it works:
```
make install
streamlit version
streamlit help
python examples/mnist-cnn.py
python examples/apocrypha.py
python examples/uber.py
python examples/tables.py
```
Check that all elements and figure work properly. You should also see the port number set to the current version number, indicating that we're not using Node.

#### Build the Wheel and Test That

Make the wheel:

```
make install   # must be in 'install' mode before making wheel
make wheel
```
Test in in a **fresh 2.7 install**:
```
cd ../streamlit-staging
pip install ../streamlit/lib/dist/streamlit-0.15.0-py3-none-any.whl
streamlit help
python -m streamlit clear_cache
python -m streamlit clear_cache
streamlit help
streamlit help
python -m streamlit clear_cache
python ../streamlit/examples/mnist-cnn.py
```
Also, if possible, test the wheel in:
- A fresh 3.6 install.
- On Linux

#### Distribute the Wheel
```
make distribute
```
Then test it on Mac and Linux.

#### Post the Release Notes to Slack
Post the release notes and declare victory!

#### Create a New Tag for this Version

```
git commit -am "version <version number>"
git tag <version number>
git push origin <version number>
```

#### Go Back to Develop Mode

If everything works and you want to go back to coding, then revert to
development mode by typing:
```
make develop
```
