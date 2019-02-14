# Contributing to Streamlit

Thanks for your interest in contributing to Streamlit! Please read the
instructions in this file for information on how we do things around here.


## Getting started

### Requirements

#### MacOS

```bash
# Some Apple dev tools
$ xcode-select --install, developer.apple.com/downloads

# Install Homebrew
$ /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# Install NPM and the ProtoBuf compiler
$ brew install npm protobuf
```

#### Ubuntu

```bash
# Install NPM, PIP, and the ProtoBuf compiler
$ sudo apt-get install npm python-pip protobuf-compiler
```


### Not a requirement, but you probably want this

```bash
$ curl https://pyenv.run | bash
$ pip install virtualenv
$ pyenv install 2.7
$ pyenv install 3.6
```


### Grab the code

For the repo on Github and then:

```bash
$ git clone https://github.com/[username]/streamlit
$ cd streamlit
$ git checkout develop
$ git checkout -b [yourbranch]
```

Now run:

```bash
$ make init && make install && make build && make develop
```

Where:
1. `make init` installs Streamlit's Python and Javascript dependencies,
   and compiles our Protobufs
2. `make install` builds and installs Streamlit into your Python environment.
3. `make build` builds the static assets.
4. `make develop` makes it so you can edit the Python source files inside
   `lib/streamlit/` and not have to reinstall the Python package with `make
   install` every time.


### Now test it out!

Test that everything above worked by running:
```bash
$ python -m examples/animation.py
```
above and you should see a Streamlit report with a progressbar in a browser.


## Development cycle

The basic developer workflow is that you run a React development server in
the background which will automatically recompile Javascript and CSS when
necessary.

To start the dev server, open up a new terminal window and run:

```bash
$ cd frontend
$ npm start
```

Note that this server listens on port 3000 rather than 8501 (i.e. Streamlit's
production port). Normally you don't have to worry about this, but it may
matter when you're developing certain features.


### When you modify Python, JS, or CSS code...

With the setup above, when you change the Python or Javascript Code everything
should automatically _just work_.

The only exception is if you modify the Proxy code, and the proxy is already
running. In that case you should kill the old proxy before you try out the new
code:

```bash
$ streamlit kill_proxy
```

### When you update protobufs...

If you ever modify our protos, you'll need to run the command below to compile
to the proto into libraries that can be used in Python and JS:

```bash
$ make protobuf
```

#### When change Javascript or Python dependencies...

```bash
make init
```

#### Testing the "Static Saving" feature

Create a bundle with the static files.
```
make build
```
Test that the locally saved example works:
```
open http://localhost:3000/?id=example
```
Then load a page and click the save icon.


## Branching model

We follow [this amazing model](https://nvie.com/posts/a-successful-git-branching-model).
That is:
- The branch that has the latest prod version is `master`.
- The branch that has the latest code is `develop`.
- You should always start working by forking off `streamlit/streamlit`
  into your personal repo and branching off of `develop`.
- When done with your changes, send a PR to merge your changes into
  `streamlit/streamlit`'s `develop` branch. Then make sure pick a reviewer
  from the list.
- If working on a large feature that will be broken into multiple PRs, create a
  feature branch at `streamlit/streamlit`. After their reviews, each PR should
  be merged into this branch. When all PRs are done, merge the feature branch
  into `streamlit/streamlit`'s develop.


## Sending a pull request

Make sure your pull request includes:
- What the PR is all about.
- What is changed in the code. Walk the reader through the code review with a
  few sentences.
- How to try out your changes.

And always lint and test your code prior to sending out the PR. That is, try
the following in the latest Python 2.x and 3.x:
- `make pylint`
- `python admin/streamlit_test.py`
- `make pytest`
- ~`make js-test`~ Actually, this is not working right now.


## Coding conventions

Streamlit's coding conventions can be found
[here](contrib/docs/conventions.md).


## Versioning convention

We use [SemVer 2.0](https://semver.org) with a couple of changes since SemVer
is more for libraries than for user-facing products.

Given a version number MAJOR.MINOR.PATCH, increment the:
- MAJOR version when you make incompatible API changes
  _OR_ bring in life-changing user-facing features,
- MINOR version when you add functionality in a backwards-compatible
  manner, and
- PATCH version when you make backwards-compatible bug fixes.


## Publishing to `PyPi`

#### Write The Release notes

Place them [here](contrib/docs/release-notes.md). Then:

#### Make Sure You Don't Have the Proxy Running

Run:

```
streamlit kill_proxy
ps -ef | grep -i python
```
and make sure that none of the lines say `proxy`.

#### Bump the Version Number

**Note:** The current version is `0.26.0`.

Update the version in the following locations:
  - `CONTRIBUTING.md` (Like, 3 lines above :) )
  - `lib/setup.py`
  - `frontend/package.json`

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
make pytest
python admin/test_streamlit.py
```
Check that all elements and figures work properly and the browser connection
should run over port `8501`.

**Note:** It's fine to `ctrl-C` kill `mnist-cnn.py` becuase it runs for so long.

#### Build the Wheel and Test That

Make the wheel:

```
make install   # must be in 'install' mode before making wheel
make wheel
```
Test in in a **fresh 2.7 install**:
```
cd ../streamlit-staging
pip install ../streamlit/lib/dist/streamlit-0.20.0-py3-none-any.whl
streamlit hello
python ../streamlit/examples/reference.py
python -m streamlit clear_cache
python -m streamlit clear_cache
python ../streamlit/examples/reference.py
python ../streamlit/examples/reference.py
python -m streamlit clear_cache
python ../streamlit/examples/mnist-cnn.py
python
>>> import streamlit as st
>>> st.write('testing')
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
git push origin develop
git checkout master
git pull
git rebase develop
```

#### Go Back to Develop Mode

If everything works and you want to go back to coding, then revert to
development mode by typing:
```
make develop
```
