# Streamlit

A stateless alternative to Jupyter notebooks for machine learning and data science.

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

## How to Develop

#### Ordinary Development Cycle

The basic developer workflow is that you run a `react` development server in the
background which will automatically recompile Javascript and CSS when necessary.

To start the server, open up a new terminal window and run:
```
cd frontend/client ; npm start
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

## How to publish a new version of the code to `PyPi`

- The current version is `0.8.0`
- Write new release notes.
- Update the version in the following locations:
  - `CONTRIBUTING.md` (*This file!*)
  - `lib/setup.py`
  - `frontend/client/package.json`
  - **Update the proxy port** to `5Mmm` where `M` is the major version number and `mm` is the minor version number. For example for `v0.14` set `proxy.port` to `5014`. _(Updating this number with each version ensures that we don't run into browser caching issues.)_
    - `lib/streamlit/config/config.yaml` : set the `proxy.port`
    - `frontend/client/src/WebClient.js` : set the line containing `ws://localhost/...`
  - *Not needed, I think:*
    - `local/client/package-lock.json`
    - `shared/client/package-lock.json`
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
python -m streamlit clear_cache
python -m streamlit clear_cache
python -m streamlit help
python -m streamlit help
python -m streamlit clear_cache
```
- Go back into the development directory execute the following (see [detailed explanation](https://packaging.python.org/tutorials/distributing-packages/)):
```
make distribute
```
- Final test that everything is running properly with `periodic_table.py` **and** `mnist_demo.py`
- Create and push a branch for this version.

## Release Notes

#### v0.8
April 23, 2018
```
We are thrilled to announce the v0.8 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

New features are:

1. Help now opens in a separate tab. So running

    python -m streamlit help

  opens a new tab named "help." Useful for flipping between help and
  your work!

2. Bar charts now show category labels correctly.

3. Streamlit now supports running multiple scripts simultaneously. If you have
   scripts called script_a.py and script_b.py then running:

    python script_a.py
    python script_b.py

  will open two separate tabs called "script_a" and "script_b." Of course,
  updating and rerunning either script will affect only its tab.

4. Float64Index is now supported.

5. We have preliminary support for printing reports. Just use your browser's
   print function.

In addition, we have a couple bug fixes:

1. Non-string input can now be passed into header functions (title(),
   header(), and subheader()) and notification functions (error(), warning(),
   info(), and success()). For example, this works:

     io.header(11)

2. Exceptions will be printed to the report even before the first call to an
   io.* function.

Remember if you get lost, just run `python -m streamlit help`. We look forward
to hearing how you use these powerful new features!
```

#### v0.6
April 9, 2018

```
We are thrilled to announce the v0.6 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

Streamlit now has a built-in help manual! To access it run:

    python -m streamlit help

Other new features include:

1. Streamlit functions are available globally in the `io` package. For example:

    from streamlit import io
    io.write('Hello world.')

2. Markdown is now the default for write(). Try:

    io.write('*Italics* **Bold** `Fixed-width`')
    io.text('This is fixed-width text.')

3. We simplified the header functions. Try:

    io.title('A big header.')
    io.header('A smaller header.')
    io.subheader('An even smaller header.')

4. We simplified alerts with the following four new functions:

    io.error('OMG!')
    io.warning('OMG!')
    io.info('OMG!')
    io.success('OMG!')

5. You can now pretty-print your own exceptions:

    io.exception(my_exception)

6. You can now get help on any function, class or package using io.help(). For
   example, for help with with Python's print() function, use:

    io.help(print)

7. We support out-of-order printing with the empty() function. For example,
   to print the first three letters of the alphabet you can do:

    io.markdown('A')
    placeholder = io.empty()
    io.markdown('C')
    placeholder.markdown('B')

8. Show the user something during a long-running computation as follows:

    with spinner(‘wait for it...'):
      long_computation()

    (You can also use the @streamlit.cache decorator to speed these up!)

Remember if you get lost, just run `python -m streamlit help`. We look forward
to hearing how you use these powerful new features!
```

#### v0.5
April 4, 2018

```
We are thrilled to announce the v0.5 of Streamlit. To upgrade, please run:

  pip install --upgrade streamlit

The major new feature in this version is caching! This allows you to quickly
run your script over and over by saving the results of long computations:

  import streamlit

  @streamlit.cache
  def long_running_computation(*args, **kwargs):
    ...

  result = long_running_computation(...)

Your first call to long_running_computation could be slow, but future calls
with the same arguments will return almost instantaneously.

NOTE: Make sure your cached functions depend only on their inputs! For
example, don't cache calls to API endpoints that may give changing results. If
you get into trouble, you can clear the cache on the command line as follows:

  python -m streamlit clear_cache

We look forward to hearing how you use this powerful feature!
```

#### v0.4
April 4, 2018
```
This version has a bug in it and should be skipped.
```

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

## Refactored Notes

### TL;DR
General development
* go to branch - `git checkout armando/refactor`
* make virtualenv using virtualenvwrapper.
  `$ mkvirtualenv -p /usr/bin/python3.6 streamlit-refactor` or `workon streamlit-refactor`
* `make` - to npm build, pip install and just generally setup everything.
* `make develop` - allows python to find streamlit in your code directory.

Python
* make lint
* make test

Javascript
* make js-lint
* make js-test

This isnt necessary for development but if you want to see where the
files would go from the 'wheel' file.
* `make release` - wheel  in dist/ directory.
* `make install` - python will find streamlit in $VIRTUAL_ENV/lib/python3.6/site-packages/streamlit-*/streamlit

### Unsorted notes.
* With `MANIFEST.in` when you do a `python setup.py install` or `python
  setup.py bdist_wheel` it will copy things in MANIFEST.in under the
  streamlit/ directory only.  Things that are not under that directory
  that are included ie root level things like `README.md`, will only be
  copied in the source distribution ie `python setup sdist`

* Now all you have to do is run `make`
* To edit the python code and have it point to the src files use `make develop`
* To install it in the python environment use `make install`
* `make release` builds the wheel file.
