# Streamlit Custom Component Example Package

## Build frontend

```shell
cd frontend
yarn build
```

## Generate distribution archives

Make sure you have the latest versions of setuptools and wheel installed:

```shell
python3 -m pip install --user --upgrade setuptools wheel
```

Now run this command from the same directory where setup.py is located:

```shell
python3 setup.py sdist bdist_wheel
```

## Upload the distribution archives

The first thing you’ll need to do is register an account on Test PyPI. To register an account, go to https://test.pypi.org/account/register/ and complete the steps on that page. Go to https://test.pypi.org/manage/account/#api-tokens and create a new API token; don’t limit its scope to a particular project, since you are creating a new project.

**Don’t close the page until you have copied and saved the token — you won’t see that token again.**

Now that you are registered, you can use twine to upload the distribution packages. You’ll need to install Twine:

```shell
python3 -m pip install --user --upgrade twine
```

Once installed, run Twine to upload all of the archives under `dist`:

```shell
python3 -m twine upload --repository testpypi dist/*
```

You will be prompted for a username and password. For the username, use `__token__`. For the password, use the token value, including the `pypi-` prefix.

## Install your newly uploaded package

```shell
python3 -m pip install --index-url https://test.pypi.org/simple/ example-package-name
```

---

For more details see: https://packaging.python.org/tutorials/packaging-projects/
