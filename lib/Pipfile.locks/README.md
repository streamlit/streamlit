# Pipfile.locks

The lock files in this directory are used by our CircleCI test environments, and ensure that we have consistent virtualenvs across multiple deploys.

If you update `lib/Pipfile`, you should next run `make pipenv-lock` twice: once from a Python 3 virtualenv that corresponds to the version being used in CircleCI, and once from a Python 2 virtualenv.
