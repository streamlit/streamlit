# Python Virtual Environments

## 1. Installing `pyenv` and `pyenv-virtualenv`

###### On MacOS

```
brew install pyenv
brew install pyenv-virtualenv
```
###### On Linux
Just [follow these instructions](https://github.com/pyenv/pyenv-installer/blob/master/README.rst).

Also make sure you have [these packages](https://github.com/pyenv/pyenv/wiki/Common-build-problems).

## 2. Establish a Local Python Environment

Create a virtualenv environment called `streamlit`:
```
pyenv install 3.6.3
pyenv virtualenv 3.6.3 streamlit
pyenv local streamlit
```
