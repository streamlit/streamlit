#!/usr/bin/env python

import subprocess
import sys

import click


def main():
    standard_cli = ["streamlit", "test", "prog_name"]
    if not _can_run_streamlit(standard_cli):
        sys.exit("Failed to run `streamlit test prog_name`")

    # When calling from module, the called argv[0] is updated by
    # __main__.py to be "streamlit" instead of "__main__.py".
    # If this doesn't occur, an assert stops execution of the program.
    module_cli = ["python", "-m", "streamlit", "test", "prog_name"]
    if not _can_run_streamlit(module_cli):
        sys.exit("Failed to run `python -m streamlit test prog_name`")

    # Invoking streamlit via `python -m streamlit.cli <command>` is a method
    # that we previously accidentally supported, but we decided that we should
    # only keep official support for the similar `python -m streamlit <command>`
    # invocation.
    unsupported_module_cli = ["python", "-m", "streamlit.cli", "test", "prog_name"]
    if _can_run_streamlit(unsupported_module_cli):
        sys.exit("`python -m streamlit.cli test prog_name` should not run")

    click.secho("CLI smoke tests succeeded!", fg="green", bold=True)


def _can_run_streamlit(command_list):
    result = subprocess.run(command_list, stdout=subprocess.DEVNULL)
    return result.returncode == 0


if __name__ == "__main__":
    main()
