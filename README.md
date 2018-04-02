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

- The current version is `0.2`
- Update the version in the following locations:
  - `readme.md`
  - `dist/setup.py`
  - `local/client/package.json`
  - `shared/client/package.json`
  - *Not needed, I think:*
    - `local/client/package-lock.json`
    - `shared/client/package-lock.json`
- Run the following commands:
```
make init
make all
```
- Test that everything is running properly with `periodic_table.py`
- Go into a temp directory (parallel to `streamlet-cloud`) and execute the following:
```
pip install --upgrade ../streamlet-cloud/dist
cp ../streamlet-cloud/examples/periodic_table.py ./
python periodic_table.py
```
- Go into the `dist` directory and execute the following (see [detailed explanation](https://packaging.python.org/tutorials/distributing-packages/)):
```
make dist
```
- Final test that everything is running properly with `periodic_table.py` **and** `mnist_demo.py`
- Create and push a branch for this version.

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
