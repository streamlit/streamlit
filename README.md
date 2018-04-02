# Streamlit

A stateless alternative to Jupyter notebooks for machine learning and data science.

## Installation

#### 1. Checkout the Repository

First [add an SSH key for Github](https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/). Then, checkout the respository:
```
git clone git@github.com:treuille/streamlit-cloud.git
```

#### 2. Install `npm`

###### MacOS

No instructions at present. Please feel free to add your own.

###### On Debian-based Linux

```
sudo apt install npm
```

#### 3. Install `pyenv` and `pyenv-virtualenv`

###### On MacOS

```
brew install pyenv
brew install pyenv-virtualenv
```
###### On Linux
Just [follow these instructions](https://github.com/pyenv/pyenv-installer/blob/master/README.rst).

Also make sure you have [these packages](https://github.com/pyenv/pyenv/wiki/Common-build-problems).

#### 4. Install hte `protobuf` compiler

###### On MacOS
```
brew install protobuf
```
###### On Linux
```
sudo apt-get install protobuf-compiler
```

#### 5. Establish a Local Python Environment

Create a virtualenv environment called `streamlit`:
```
pyenv install 3.6.3
pyenv virtualenv 3.6.3 streamlit
pyenv local streamlit
```

#### 6. Initialize the Repository

```
make init
make all
make production
```

## How to publish a new version of the code to `PyPi`

- The current version is `0.3`
- Update the version in the following locations:
  - `readme.md`
  - `dist/setup.py`
  - `local/client/package.json`
  - `shared/client/package.json`
  - **Update the proxy port** to `5Mmm` where `M` is the major version number and `mm` is the minor version number. For example for `v0.14` set `proxy.port` to `5014`. _(Updating this number with each version ensures that we don't run into browser caching issues.)_
    - `config.py` : set the `proxy.port`
    - `local/client/src/WebClient.js` : set the line containing `ws://localhost/...`
  - *Not needed, I think:*
    - `local/client/package-lock.json`
    - `shared/client/package-lock.json`
- Run the following commands:
```
make init
make all
```
- Test that everything is running properly with `periodic_table.py`
- Run the following commands:
```
make production
make package
```
- Go into a temp directory (parallel to `streamlet-cloud`) and execute the following:
```
pip install --upgrade ../streamlet-cloud/dist
cp ../streamlet-cloud/examples/periodic_table.py ./
python periodic_table.py
```
- Go back into the development directory execute the following (see [detailed explanation](https://packaging.python.org/tutorials/distributing-packages/)):
```
make distribute
```
- Final test that everything is running properly with `periodic_table.py` **and** `mnist_demo.py`
- Create and push a branch for this version.

## Release Notes

#### v0.3
April 2, 2018

```
We are thrilled to announce the v0.3 of Streamlit. To upgrade, please run:

  pip install --upgrade streamlit

New features include:

1. A beautiful new UI designed by Thiago Teixeira.

2. Support for datetime and timedelta Pandas types.

3. A new simplified charting API. Please use:

     write.line_chart
     write.area_chart
     write.bar_chart

   You can see more examples in periodic_table.py.

4. Fixed a bug when displaying DataFrames with multiple columns having
   the same name.
```

## Development Dependencies *(Deprecated)*

*Note that these assume you have MacOS, and have only been tested on this platform.*

- [Homebrew](brew.sh)
  - Lets us install lots of other useful things.
- [NPM](https://www.npmjs.com/)
  - `brew install npm`
  - Lets us install `npm` packages.
- [Create React App](https://github.com/facebookincubator/create-react-app/)
  - `npm install -g create-react-app`
  - The application framework for our React SPA.
- `protobufs` and `[protobufjs](https://www.npmjs.com/package/protobufjs)`
  - `brew install protobuf`
  - `pip install protobuf`
  - `npm install -g protobufjs`
  - Allows us to communicate the messages quickly.
  - On Linux, you may have to run `sudo pbjs` so PBJS can finish its
    installation.
- `pillow`
  - `pip install pillow`
  - Allows us to manipulate images.
- `aiohttp`
  - `pip install aiohttp`
  - Allows us to run http connections.
- `motor`
  - `pip install motor`
  - Allows us to connect to the Mongo database.

For the examples:
- `pandas`
  - `pip install pandas`
- `yaml`
  - `pip install pyyaml`
