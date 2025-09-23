---
applyTo: "**/*.py"
---

# Python Development Guide

- Supported Python versions: 3.9 - 3.13
- Docstrings: Numpy style
- Linter: Ruff 0.x (`.ruff.toml`)
- Formatter: Ruff 0.x (`.ruff.toml`)
- Type Checker: mypy 1.x (`mypy.ini`)
- Testing: pytest 8.x (`lib/pytest.ini`)

## Key Principles

- PEP 8 Compliance: Adhere to PEP 8 guidelines for code style, with Ruff as the primary linter and formatter.
- Elegance and Readability: Strive for elegant and Pythonic code that is easy to understand and maintain.
- Zen of Python: Keep the Zen of Python in mind when making design decisions.
- Avoid inheritance (prefer composition).
- Avoid methods (prefer non-class functions, or static).
- Name functions and variables in such a way that you don't need comments to explain the code.
- Python folder and filenames should all be snake_cased regardless of what they contain.
- Prefer importing entire modules instead of single functions: `from streamlit import mymodule` over `from streamlit.mymodule import internal_function`
- Prefer keyword arguments, use positional values only for required values that frame the API. Enhancing arguments should be keyword-only.
- Capitalize comments, use proper grammar and punctuation, and no cursing.
- Inside a module, anything that is declared at the root level MUST be prefixed with a _ if it's only used inside that module (anything private).
- Prioritize new features in Python 3.9+.

## Docstrings

- Use Numpydoc style.
- Docstrings are meant for users of a function, not developers who may edit the internals of that function in the future. If you want to talk to future developers, use comments.
- All modules that we expect users to interact with must have top-level docstrings. If a user is not meant to interact with a module, docstrings are optional.

## Package Structure

- `streamlit/`: The main Streamlit library package.
- `streamlit/elements`: Backend code of elements and widgets.
- `streamlit/runtime`: App runtime and execution logic.
- `streamlit/web`: Web server and CLI implementation
- `streamlit/commands`: `st` commands that don't add UI elements.
- `streamlit/components`: Backend-implementation of custom components.
- `streamlit/hello`: `streamlit hello` app implementation.
- `streamlit/navigation`: Multi-page app implementation.
- `streamlit/proto`: Generated protobuf definitions for client-server communication.
- `streamlit/testing`: AppTest v1 implementation.
- `streamlit/vendor`: Vendored dependencies.
- `streamlit/watcher`: File-watcher implementations.
- `streamlit/__init__.py`: Defines all commands in the `st` namespace.
- `setup.py`: Setup configuration of the Streamlit library.
- `tests`: Python unit tests (pytest).

## Typing

- Add typing annotations to every new function, method or class member.
- Use `typing_extensions` for back-porting newer typing features.
- Use future annotations via `from __future__ import annotations`.

## Relevant `make` commands

Run from the repo root:

- `make python-lint`: Lint and check formatting of Python files (ruff).
- `make python-tests`: Run all Python unit tests (pytest).
- `make python-types`: Run the Python type checker (mypy & ty).
- `make python-format`: Format Python files (ruff).
