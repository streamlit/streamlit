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

## Publishing to `PyPi`

#### Create a New Branch for this Version

Create a new branch called `versions/<version_number>`.

#### Write The Release notes

Place them [here](docs/release-notes.md). Then:
```
git commit -am <commit message>
git push
```

#### Make Sure You Don't Have the Proxy Running

Run:

```
ps -ef | grep -i python
```
and make sure that none of the lines say `proxy`.

#### Bump the Version Number

**Note:** The current version is `0.8.2`.

Update the version in the following locations:
  - `CONTRIBUTING.md` (*Right above where it says version number!*)
  - `lib/setup.py`
  - `frontend/package.json`
  - **Update the proxy port** to `5Mmm` where `M` is the major version number and `mm` is the minor version number. For example for `v0.14` set `proxy.port` to `5014`. _(Updating this number with each version ensures that we don't run into browser caching issues.)_
    - `lib/streamlit/config/config.yaml` : set the `proxy.port`
    - `frontend/src/WebClient.js` : set the line containing `ws://localhost/...`

#### Build Streamlit and Test It Without Node

Build Streamlit so that it can run without the Node development server:
```
make build
```
Test that it works
```
make install
python -m streamlit help
python examples/mnist-cnn.py
```
Check that all elements and figure work properly. You should also see the port number set to the current version number, indicating that we're not using Node.

If everything works, then revert to development mode by typing:
```
make develop
```

#### Build the Wheel and Test That

This assumes that the current working directory is called `streamlit` and you have a parallel folder called `streamlit-staging` to test this version.

```
make wheel
cd ../streamlit-staging
pip install --upgrade ../streamlit/lib/dist/streamlit-0.9.0-py3-none-any.whl
python -m streamlit help
python -m streamlit clear_cache
python -m streamlit clear_cache
python -m streamlit help
python -m streamlit help
python -m streamlit clear_cache
python ../streamlit/examples/mnist-cnn.py
```
Also, if possible, test the wheel in Linux.

#### Distribute the Wheel
```
make distribute
```
Then test it on Mac and Linux.

#### Post the Release Notes to Slack

Post the release notes and declare victory!

- Run the following commands:
```
make init
make all
```
- Test that everything is running properly with:
```
./streamlit_run -m streamlit help
```
Then, open an interactive python shell with
```
./streamlit_run
```
and type in the following commands:
```
from streamlit import io
io.write('Hello, world!')
```
Make sure that that is working properly.
- Run the following commands:
```
make production
make package
```
- Go into a temp directory (parallel to `streamlet-cloud`) and execute the following:
```
pip install --upgrade ../streamlet-cloud/dist

```
- Go back into the development directory execute the following (see [detailed explanation](https://packaging.python.org/tutorials/distributing-packages/)):
```
make distribute
```
- Final test that everything is running properly with `periodic_table.py` **and** `mnist_demo.py`
- Create and push a branch for this version.

## Refactored Notes

### TL;DR

#### General development
- go to branch - `git checkout armando/refactor`
- make virtualenv using virtualenvwrapper.
  `$ mkvirtualenv -p /usr/bin/python3.6 streamlit-refactor` or `workon streamlit-refactor`
- `make` - to npm build, pip install and just generally setup everything.
- `make develop` - allows python to find streamlit in your code directory.

#### Python
- make lint
- make test

#### Javascript
- make js-lint
- make js-test

This isnt necessary for development but if you want to see where the
files would go from the 'wheel' file.
* `make release` - wheel  in dist/ directory.
* `make install` - python will find streamlit in $VIRTUAL_ENV/lib/python3.6/site-packages/streamlit-*/streamlit

### Unsorted notes.
- With `MANIFEST.in` when you do a `python setup.py install` or `python
  setup.py bdist_wheel` it will copy things in MANIFEST.in under the
  streamlit/ directory only.  Things that are not under that directory
  that are included ie root level things like `README.md`, will only be
  copied in the source distribution ie `python setup sdist`

- Now all you have to do is run `make`
- To edit the python code and have it point to the src files use `make develop`
- To install it in the python environment use `make install`
- `make release` builds the wheel file.
