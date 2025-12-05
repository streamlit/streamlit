Thanks for your interest in helping improve Streamlit! 🎉

**If you are looking for Streamlit's documentation, go here instead: <https://docs.streamlit.io>**

This wiki is for people who want to contribute code to Streamlit. There are also other ways to contribute, such as [reporting bugs](https://github.com/streamlit/streamlit/issues/new?template=bug_report.yml), creating [feature requests](https://github.com/streamlit/streamlit/issues/new?template=feature_request.yml), helping other users [in our forums](https://discuss.streamlit.io), Stack Overflow, etc., or just being an awesome member of the community!

## Before contributing

**If your contribution is more than a few lines of code, then prior to starting to code on it please post in the issue saying you want to volunteer, and then wait for a positive response.** And if there is no issue for it yet, create it first.

This helps make sure:

1. Two people aren't working on the same thing
2. This is something Streamlit's maintainers believe should be implemented/fixed
3. Any API, UI, or deeper architectural changes that need to be implemented have been fully thought through by Streamlit's maintainers
4. Your time is well spent!

> [!TIP]
> To be clear: if you open a PR that adds a new feature (and isn't just a bug fix or similar) *without* prior support from the Streamlit team, the chances of getting it merged are *extremely low*. Adding a new feature comes with a lot of baggage, such as thinking through the exact API, making sure it fulfills our standards, and maintaining it in the future – even if it's just a small parameter.

## Style Guide

Check out [Streamlit's style guide](./wiki/code-style-guide.md). We use [Prettier](https://prettier.io), [Ruff](https://github.com/astral-sh/ruff) and [ESLint](https://eslint.org/) to format and lint code, but some things go beyond what auto-formatters and linters can do. So please take a look!

## How to build Streamlit

### 1. Set up your base environment

#### MacOS

```bash
# Some Apple dev tools (developer.apple.com/downloads)
$ xcode-select --install

# Install Homebrew
$ /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install the Protobuf compiler
$ brew install protobuf
```

**Installing Node JS and yarn**

We recommend that you [manage your nodejs installation with nvm](https://github.com/nvm-sh/nvm#install--update-script).
After following the instructions linked above to install `nvm`, use the following command to install the latest supported node version

```bash
# Install node
nvm install node
```

**Note:** Node has added Corepack which is a manager of package managers 🥳. It supports yarn! You can enable it by running the following:

```bash
corepack enable
```

You may need to `brew install corepack` depending on how you installed node.

#### Ubuntu

```bash
# Install some essentials
$ sudo apt-get update
$ sudo apt-get install -y sudo make build-essential curl git rsync unzip protobuf-compiler

# Set frontend dependencies:
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
$ source ~/.bashrc
$ nvm install node
$ corepack enable

# Install uv for Python
$ curl -LsSf https://astral.sh/uv/install.sh | sh

# Install virtual environment in lib:
$ cd lib/
$ uv venv --python 3.12
$ source .venv/bin/activate
```

#### Windows

Streamlit's development setup is pretty Mac- and Linux-centric. If you're doing Streamlit development on Windows, we suggest using our [devcontainer](./.devcontainer) via Github Codespaces or locally via VS Code. Alternatively, you can also spin up a Linux VM (e.g. via [VirtualBox](https://www.virtualbox.org/), which is free); or your own Linux Docker image; or using Microsoft's WSL ("Windows Subsystem for Linux").

### 2. Grab the code

*(You probably already know how to do this, but just in case...)*

First fork [the repo](https://github.com/streamlit/streamlit) via the UI on Github and then do the following:

```bash
git clone https://github.com/${YOUR_NAME}/streamlit.git
cd streamlit
git remote add remote https://github.com/streamlit/streamlit.git
git checkout develop
git submodule update --init
git checkout -b ${BRANCH_NAME}
```

### 3. Create a new Python environment

Create a virtual environment for Streamlit using your favorite tool (`virtualenv`, `pipenv`, etc) and activate it. Here's how we do it with [`venv`](https://docs.python.org/3/library/venv.html):

```bash
cd lib
python -m venv venv
```

Note that, with `venv` this process should be done from any directory, but it is recommended to do it from the `lib/` directory to keep all python files in one directory.

```bash
source ./venv/bin/activate
```

## How to develop Streamlit

The basic developer workflow is that you run a React development server on port 3000 in one terminal and run Streamlit CLI commands in another terminal.

### 1. One-time setup

```bash
make all-dev
```

### 2. Build the frontend

```bash
make frontend
```

### 3. Start the dev server (hot-reloading)

The easiest way to start the dev server from the terminal, is to run:

```bash
make frontend-dev
```

> [!Note]
> This server listens on port `3000` rather than `8501` (i.e. Streamlit's production port). Normally you don't have to worry about this, but it may matter when you're developing certain features. The server is automatically updating to the changes you apply in the frontend code (hot-reloading).

### 4. Run Streamlit

Open another terminal, start your Python environment and run Streamlit.

If you're using `venv`, that's:

```bash
$ cd lib
$ source ./venv/bin/activate
$ cd ..

# Now run any Streamlit command you want, such as:
$ streamlit hello
```

### 5. What to do when you modify some code

#### When you modify JS, or CSS code

Since we use that awesome dev server above, when you change any JS/CSS code everything should automatically *just work* without the need to restart any of the servers.

#### When you modify Python code

When you modify Python code, you should kill the old Streamlit server, if any (<key>ctrl-c</key> on the terminal) and then restart it.

#### When you update protobufs

If you ever modify our protobufs, you'll need to run the command below to compile
the protos into libraries that can be used in Python and JS:

```bash
make protobuf
```

#### When Javascript or Python dependencies change

```bash
make init
```

> [!IMPORTANT]
> If your change updates `frontend/yarn.lock` (for example, after adding or upgrading dependencies), run `cd frontend && yarn dedupe` before committing. Our `scripts/check_yarn_dedupe.sh` hook enforces this locally (via pre-commit) and in CI, so handling it upfront keeps your PR green.

### 6. Running tests

You should always write unit tests and end-to-end tests! This is true for new features, but also for bugs; this way when you fix a bug you can be sure it will not show up again. So bug-fixing is actually a great way to increase our test coverage where it actually matters.

#### Python unit tests

- Run all with:

  ```bash
  make python-tests
  ```

- Run a specific test file with:

  ```bash
  PYTHONPATH=lib pytest lib/tests/streamlit/the_test_name.py
  ```

- Run a specific test inside a test file with:

  ```bash
  PYTHONPATH=lib pytest lib/tests/streamlit/the_test_name.py -k test_that_something_works
  ```

- Some tests require you to set up credentials to connect to Snowflake and install [the `snowflake-snowpark-python` package](https://pypi.org/project/snowflake-snowpark-python/). Information on how the Snowflake environment is set up is in our [test utils](./lib/tests/testutil.py) including environment variables to be set. They are skipped by default when running tests. To enable them and disable all others, pass the `--require-integration` flag to `pytest`.

  ```bash
  PYTHONPATH=lib pytest --require-integration
  ```

#### JS unit tests

- Run all with:

  ```bash
  make frontend-tests
  ```

- Run specific tests:

  ```bash
  cd frontend
  yarn workspace @streamlit/lib test src/path/to/test_file.test.ts
  ```

NOTE: Making changes to a react component may cause unit snapshot tests (which are designed to catch unintended changes to jsx/tsx components) to fail. Once you've double-checked that all of the changes in the failing snapshot test are expected, you can follow the prompts that appear after running `make frontend-tests` to update the snapshots, check them into source control, and include them in your PR.

#### End-to-end tests

You can find information about our e2e testing setup [here](./wiki/running-e2e-tests.md).

### 7. Formatting, linting, and type-checking

We've set up various formatting, linting, and type-checking rules that our Continuous Integration checks to maintain code quality and consistency. Before merging a Pull Request, all formatting and linting rules must be satisfied and passed successfully.

### Python

For Python, we use [ruff](https://github.com/astral-sh/ruff) for formatting & linting and [mypy](https://github.com/python/mypy) for type-checking.

#### Formatting

To format all Python code & sort the imports, run the following command:

```bash
make python-format

```

Alternatively, you can use the `ruff format` command directly.

#### Linting

To run the linter, use the command below:

```bash
make python-lint

```

Alternatively, you can use the `ruff check` command directly.

#### Type-checking

For type-checking, run:

```bash
make python-types
```

### Javascript / Typescript

For Javascript/Typescript, we utilize Prettier and ESLint.

#### Formatting

To format your code, run this command:

```bash
make frontend-format

```

#### Linting

To initiate the linting process, use this command:

```bash
make frontend-lint
```

#### Type-checking

For type-checking, run:

```bash
make frontend-types
```

### VS-Code / Cursor Setup

For development in VS Code, we recommend installing the extensions listed in [`.vscode/extensions.json`](./.vscode/extensions.json) and for an optimized configuration you can use the VS-Code settings from [`.devcontainer/devcontainer.json`](./.devcontainer/devcontainer.json).

### Pre-commit hooks

When Streamlit's pre-commit detects that one of the linters has failed,
it automatically lints the files and does not allow the commit to pass.
Please review the changes after lint has failed and commit them again,
the second commit should pass,
because the files were linted after trying to do the first commit.

But you can run pre-commit hooks manually as needed.

- Run all checks on your staged files by using:

  ```shell
  pre-commit run
  ```

- Run all checks on all files by using:

  ```shell
  pre-commit run --all-files
  ```

## Troubleshooting

#### Test `test_streamlit_version` fails

```python
def test_streamlit_version(self):
    """Test streamlit.__version__."""
    self.assertEqual(__version__, get_version())
     AssertionError: '1.11.0' != '1.11.1'
      - 1.11.0
      ?      ^
      + 1.11.1
      ?      ^
```

To fix this make sure you have setup your Python's venv environments correctly, upgrade your dependencies or recreate your environment and repeat setup.

You might have double environments which mismatch for example by accident you could have created venv Python environment inside `streamlit` repository and second one inside `streamlit/lib`. Remove them.

#### `protoc` command fails because of version mismatch

If the `protoc` command fails and there is a version mismatch reported, try to install the correct version.

- Go to [Protobuf releases](https://github.com/protocolbuffers/protobuf/releases)
- Choose the [Protobuf tag](https://github.com/protocolbuffers/protobuf/tags) which matches Python's environment Protobuf version, for example [3.20.0](https://github.com/protocolbuffers/protobuf/releases/tag/v3.20.0). Call `pip show protobuf` or equivalent to find this out.
- Download zip containing protoc for your system, example: [protoc-3.20.0-osx-x86_64.zip](https://github.com/protocolbuffers/protobuf/releases/download/v3.20.0/protoc-3.20.0-osx-x86_64.zip)

<details>
<summary>Example for macOS</summary>

```bash
curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v3.20.0/protoc-3.20.0-osx-x86_64.zip
sudo unzip -o protoc-3.20.0-osx-x86_64.zip -d /usr/local bin/protoc
sudo unzip -o protoc-3.20.0-osx-x86_64.zip -d /usr/local 'include/*'
# Print out your System's Protoc version
protoc --version
```

</details>

<details>
<summary>Example for Linux (ARM)</summary>

```bash
curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v3.20.0/protoc-3.20.0-linux-aarch_64.zip
sudo unzip -o protoc-3.20.0-linux-aarch_64.zip -d /usr/local bin/protoc
sudo unzip -o protoc-3.20.0-linux-aarch_64.zip -d /usr/local 'include/*'

# (optional) remove old version
rm /usr/bin/protoc
ln -s /usr/local/bin/protoc /usr/bin/protoc

# Print out your System's Protoc version
protoc --version
```

</details>

#### Installing conda and conda-build

If you want to build Streamlit as a conda package on your local machine (needing to do this should be rare), you'll need to install a few extra dependencies so that the `make conda-package` target works.

1. First, install `conda` using your favorite package manager or by following [these instructions](https://docs.conda.io/projects/conda/en/latest/user-guide/install/index.html). Both `anaconda` and `miniconda` will work.
2. Then, run `conda install conda-build`.

## Introducing dependencies

We aim to only introduce dependencies in this project that have reasonable restrictions and comply with various laws.

![Views](https://api.views-badge.org/badge/st-wiki-contributing)
