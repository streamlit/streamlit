# tiny-notebook
A stateless alternative to Jupyter notebooks for machine learning and data science.

## Installation Instructions

#### Checkout the Repository

First [add an SSH key for Github](https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/). Then, checkout the respository:
```
git clone git@github.com:treuille/streamlet-cloud.git
```

#### Establish a Local Python Environment

First install `pipenv` with `brew install pipenv` (on MacOS) or just [follow these instructions](https://github.com/pyenv/pyenv-installer).
```
pip install virtualenvwrapper
pip install virtualenv
pip install pyenv-virtualenv
pip install pipenv
```

## Dependencies

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
- `pillow`
  - `pip install pillow`
  - Allows us to manipulate images.
- `aiohttp`
  - `pip install aiohttp`
  - Allows us to run http connections.
- `motor`
  - `pip install motor`
  - Allows us to connect to the Mongo database.
