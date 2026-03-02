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
> To be clear: if you open a PR that adds a new feature (and isn't just a bug fix or similar) _without_ prior support from the Streamlit team, the chances of getting it merged are _extremely low_. Adding a new feature comes with a lot of baggage, such as thinking through the exact API, making sure it fulfills our standards, and maintaining it in the future – even if it's just a small parameter.

## Pull request expectations

These expectations apply to all contributors and all pull requests.

### Expectations for all contributions

- Properly fill out the [PR template](./.github/pull_request_template.md) with concrete details (not placeholders).
- Keep PRs narrowly scoped. If your changes are broad, split them into smaller, reviewable PRs.
- Address prior review feedback before requesting another review cycle.
- Please respond to requested changes or maintainer questions within 14 days. If you need more time, leave a short status comment.
- If you open additional PRs while prior feedback remains unaddressed, maintainers may pause or close review of newer PRs until earlier feedback is handled.
- Repeated non-response may result in newer PRs being deprioritized or closed.

### Issue and pull request discussion expectations

Help us keep GitHub issues and PR threads readable and actionable.

- Keep comments **relevant and constructive**. Add new information (a minimal repro, logs, screenshots, answers to maintainer questions, or review follow-ups).
- Avoid low-signal replies like **"+1" / "same"**. Use GitHub reactions instead.
- **No spam or promotion.** Do not post recruiting links, unsolicited links to third-party products/services, link-only replies, or repeated off-topic advertising.
- Avoid duplicate comments that only restate existing points (including copy/paste or light paraphrasing). If you have nothing new to add, consider using a reaction instead of commenting.

Maintainers may hide, edit, or delete comments that don’t contribute to the discussion, lock threads, limit interactions, and take other moderation actions when needed. Repeated or severe abuse may result in restrictions or bans. See our [Code of Conduct](./CODE_OF_CONDUCT.md).

### Expectations for AI-assisted contributions

We welcome responsible use of AI-assisted tools in this repository. AI can help contributors move faster, but it does not replace author ownership. If you open a PR, you are responsible for the correctness, scope, testing, and maintainability of that change.

### Maintainer discretion for repeated low-quality patterns

To protect maintainer bandwidth and keep the process fair for active contributors, maintainers may take stricter action when a contributor repeatedly submits low-quality or non-responsive PRs, spams issues/PRs with low-signal or duplicative comments, or posts promotional/spam links. This may include deprioritizing reviews, requesting that existing feedback be resolved first, closing PRs, removing disruptive content, locking threads, limiting interactions, or other GitHub moderation actions. When necessary, we also reserve the right to protect the project and community up to and including banning users in severe or repeated abuse cases.

## AI Agent Skills and Subagents

This repository includes skills and subagents in `.claude/` usable with Claude Code and Cursor to assist AI coding agents with common development tasks. Skills are invoked automatically based on their description, but can also be triggered manually via `/skill-name` (e.g., `/checking-changes`).

### Skills

| Skill | When to use |
|-------|-------------|
| `checking-changes` | After making backend or frontend changes, before committing |
| `assessing-external-test-risk` | When reviewing branch or PR changes to decide whether `@pytest.mark.external_test` coverage is needed for externally hosted or embedded scenarios |
| `debugging-streamlit` | When testing code changes, investigating bugs, or checking UI behavior |
| `discovering-make-commands` | To list available `make` commands for build, test, lint, or format tasks |
| `fixing-streamlit-ci` | When CI checks fail and you need to diagnose and fix errors |
| `implementing-new-features` | When adding new elements, widgets, or features spanning backend, frontend, and protobufs |
| `understanding-streamlit-architecture` | When debugging cross-layer issues, understanding how features work end-to-end, or onboarding to the codebase |
| `creating-pull-requests` | When changes are ready to be submitted as a PR with proper labels and formatting |
| `addressing-pr-review-comments` | When a PR has reviewer feedback that needs to be addressed |
| `updating-internal-docs` | After significant codebase changes to review and update internal documentation |
| `finalizing-pr` | When changes are ready to merge — runs quality checks, simplifies code, and creates/updates the PR |

### Subagents

Subagents run autonomously in a fresh context, which optimizes for context size and cost. They can be triggered manually via `/subagent-name` (e.g., `/reviewing-local-changes`).

| Subagent | When to use |
|----------|-------------|
| `reviewing-local-changes` | When you want a code review of the current branch's changes |
| `simplifying-local-changes` | When you want to simplify and refine code for clarity and maintainability |
| `fixing-pr` | When a PR needs CI fixes, review feedback handling, and validation before merge |

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

# (Recommended) Install GitHub CLI - used by AI agents for PR and issue management
$ brew install gh

# (Recommended) Install ripgrep - used by AI agents for fast log/code search
$ brew install ripgrep
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

# (Recommended) Install GitHub CLI - used by AI agents for PR and issue management
# See https://cli.github.com/ for installation instructions

# (Recommended) Install ripgrep - used by AI agents for fast log/code search
$ sudo apt-get install -y ripgrep
```

#### Windows

Streamlit's development setup is pretty Mac- and Linux-centric. If you're doing Streamlit development on Windows, we suggest using our [devcontainer](./.devcontainer) via Github Codespaces or locally via VS Code. Alternatively, you can also spin up a Linux VM (e.g. via [VirtualBox](https://www.virtualbox.org/), which is free); or your own Linux Docker image; or using Microsoft's WSL ("Windows Subsystem for Linux").

### 2. Grab the code

_(You probably already know how to do this, but just in case...)_

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

We use [uv](https://docs.astral.sh/uv/) to manage Python dependencies and virtual environments. If you don't have uv installed, you can install it with:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

The virtual environment and dependencies will be automatically created and managed when you run `make all-dev` in the next step. uv creates a `.venv` directory in the repository root.

## How to develop Streamlit

The basic developer workflow is that you run a React development server (default port `3000`) in one terminal and run Streamlit CLI commands in another terminal.

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
> This server defaults to port `3000` rather than `8501` (i.e. Streamlit's production port), but you can change it with `VITE_PORT` (or `PORT`), for example: `VITE_PORT=3002 make frontend-dev`.
> To point the frontend dev server at a different backend, set `DEV_SERVER_BACKEND_URL`, for example: `DEV_SERVER_BACKEND_URL=http://localhost:8502 make frontend-dev`.
> The server automatically updates when frontend code changes (hot-reloading).

### 4. Run Streamlit

Open another terminal and run Streamlit using `uv run`:

```bash
# Run any Streamlit command, such as:
uv run streamlit hello
```

### 5. What to do when you modify some code

#### When you modify JS, or CSS code

Since we use that awesome dev server above, when you change any JS/CSS code everything should automatically _just work_ without the need to restart any of the servers.

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
  uv run pytest lib/tests/streamlit/the_test_name.py
  ```

- Run a specific test inside a test file with:

  ```bash
  uv run pytest lib/tests/streamlit/the_test_name.py -k test_that_something_works
  ```

- Some tests require you to set up credentials to connect to Snowflake and install [the `snowflake-snowpark-python` package](https://pypi.org/project/snowflake-snowpark-python/). Information on how the Snowflake environment is set up is in our [test utils](./lib/tests/testutil.py) including environment variables to be set. They are skipped by default when running tests. To enable them and disable all others, pass the `--require-integration` flag to `pytest`.

  ```bash
  uv run pytest --require-integration
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

Alternatively, you can use `uv run ruff format` directly.

#### Linting

To run the linter, use the command below:

```bash
make python-lint

```

Alternatively, you can use `uv run ruff check` directly.

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

> [!TIP]
> **For Cursor users:** We suggest enabling the "Include third-party skills, subagents, and other configs" setting in Cursor's preferences to take full advantage of all available agent skills and configs.

### Pre-commit hooks

When Streamlit's pre-commit detects that one of the linters has failed,
it automatically lints the files and does not allow the commit to pass.
Please review the changes after lint has failed and commit them again,
the second commit should pass,
because the files were linted after trying to do the first commit.

But you can run pre-commit hooks manually as needed.

- Run all checks on your staged files by using:

  ```shell
  uv run pre-commit run
  ```

- Run all checks on all files by using:

  ```shell
  uv run pre-commit run --all-files
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

To fix this make sure your Python environment is set up correctly. Try running `uv sync --group dev` to reinstall dependencies, or delete the `.venv` directory and run `make all-dev` again to recreate the environment.

#### `protoc` command fails because of version mismatch

If the `protoc` command fails and there is a version mismatch reported, try to install the correct version.

- Go to [Protobuf releases](https://github.com/protocolbuffers/protobuf/releases)
- Choose the [Protobuf tag](https://github.com/protocolbuffers/protobuf/tags) which matches Python's environment Protobuf version, for example [3.20.0](https://github.com/protocolbuffers/protobuf/releases/tag/v3.20.0). Call `uv run pip show protobuf` or equivalent to find this out.
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

## Introducing dependencies

We aim to only introduce dependencies in this project that have reasonable restrictions and comply with various laws.

![Views](https://api.views-badge.org/badge/st-wiki-contributing)
