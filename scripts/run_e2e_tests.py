#!/usr/bin/env python
# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import shutil
import signal
import subprocess
import sys
import time
from contextlib import contextmanager
from os.path import abspath, basename, dirname, join, splitext
from pathlib import Path
from tempfile import TemporaryFile
from typing import List

import click
import requests

ROOT_DIR = dirname(dirname(abspath(__file__)))  # streamlit root directory
FRONTEND_DIR = join(ROOT_DIR, "frontend")
COMPONENT_TEMPLATE_DIRS = {
    "template": join(ROOT_DIR, "component-template/template/my_component"),
    "template-reactless": join(
        ROOT_DIR, "component-template/template-reactless/my_component"
    ),
}

CREDENTIALS_FILE = os.path.expanduser("~/.streamlit/credentials.toml")
IS_CIRCLECI = os.getenv("CIRCLECI")


class QuitException(BaseException):
    pass


class AsyncSubprocess:
    """A context manager. Wraps subprocess.Popen to capture output safely."""

    def __init__(self, args, cwd=None, env=None):
        self.args = args
        self.cwd = cwd
        self.env = env
        self._proc = None
        self._stdout_file = None

    def terminate(self):
        """Terminate the process and return its stdout/stderr in a string."""
        # Terminate the process
        if self._proc is not None:
            self._proc.terminate()
            self._proc.wait()
            self._proc = None

        # Read the stdout file and close it
        stdout = None
        if self._stdout_file is not None:
            self._stdout_file.seek(0)
            stdout = self._stdout_file.read()
            self._stdout_file.close()
            self._stdout_file = None

        return stdout

    def __enter__(self):
        self.start()
        return self

    def start(self):
        # Start the process and capture its stdout/stderr output to a temp
        # file. We do this instead of using subprocess.PIPE (which causes the
        # Popen object to capture the output to its own internal buffer),
        # because large amounts of output can cause it to deadlock.
        self._stdout_file = TemporaryFile("w+")
        self._proc = subprocess.Popen(
            self.args,
            cwd=self.cwd,
            stdout=self._stdout_file,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ.copy(), **self.env} if self.env else None,
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._proc is not None:
            self._proc.terminate()
            self._proc = None
        if self._stdout_file is not None:
            self._stdout_file.close()
            self._stdout_file = None


class Context:
    def __init__(self):
        # Whether to prompt to continue on failure or run all
        self.always_continue = False
        # True if Cypress will record videos of our results.
        self.record_results = False
        # True if we're automatically updating snapshots.
        self.update_snapshots = False
        # Parent folder of the specs and scripts.
        # 'e2e' for tests we expect to pass or 'e2e_flaky' for tests with
        # known issues.
        self.tests_dir_name = "e2e"
        # Set to True if any test fails.
        self.any_failed = False
        # Environment variables to pass to Cypress
        self.cypress_env_vars = {}

    @property
    def tests_dir(self) -> str:
        return join(ROOT_DIR, self.tests_dir_name)

    @property
    def cypress_flags(self) -> List[str]:
        """Flags to pass to Cypress"""
        flags = ["--config", f"integrationFolder={self.tests_dir}/specs"]
        if self.record_results:
            flags.append("--record")
        if self.update_snapshots:
            flags.extend(["--env", "updateSnapshots=true"])
        if self.cypress_env_vars:
            vars_str = ",".join(f"{k}={v}" for k, v in self.cypress_env_vars.items())
            flags.extend(["--env", vars_str])
        return flags


def remove_if_exists(path):
    """Remove the given folder or file if it exists"""
    if os.path.isfile(path):
        os.remove(path)
    elif os.path.isdir(path):
        shutil.rmtree(path)


@contextmanager
def move_aside_file(path):
    """Move a file aside if it exists; restore it on completion"""
    moved = False
    if os.path.exists(path):
        os.rename(path, f"{path}.bak")
        moved = True

    try:
        yield None
    finally:
        if moved:
            os.rename(f"{path}.bak", path)


def create_credentials_toml(contents):
    """Writes ~/.streamlit/credentials.toml"""
    os.makedirs(dirname(CREDENTIALS_FILE), exist_ok=True)
    with open(CREDENTIALS_FILE, "w") as f:
        f.write(contents)


def kill_with_pgrep(search_string):
    result = subprocess.run(
        f"pgrep -f '{search_string}'",
        shell=True,
        universal_newlines=True,
        capture_output=True,
    )

    if result.returncode == 0:
        for pid in result.stdout.split():
            try:
                os.kill(int(pid), signal.SIGTERM)
            except Exception as e:
                print("Failed to kill process", e)


def kill_streamlits():
    """Kill any active `streamlit run` processes"""
    kill_with_pgrep("streamlit run")


def kill_app_servers():
    """Kill any active app servers spawned by this script."""
    kill_with_pgrep("running-streamlit-e2e-test")


def run_test(
    ctx: Context,
    specpath: str,
    streamlit_command: List[str],
    show_output: bool = False,
) -> bool:
    """Run a single e2e test.

     An e2e test consists of a Streamlit script that produces a result, and
     a Cypress test file that asserts that result is as expected.

    Parameters
    ----------
    ctx : Context
        The Context object that contains our global testing parameters.
    specpath : str
        The path of the Cypress spec file to run.
    streamlit_command : list of str
        The Streamlit command to run (passed directly to subprocess.Popen()).

    Returns
    -------
    bool
        True if the test succeeded.

    """
    SUCCESS = "SUCCESS"
    RETRY = "RETRY"
    SKIP = "SKIP"
    QUIT = "QUIT"

    result = None

    # Move existing credentials file aside, and create a new one if the
    # tests call for it.
    with move_aside_file(CREDENTIALS_FILE):
        create_credentials_toml('[general]\nemail="test@streamlit.io"')

        # Loop until the test succeeds or is skipped.
        while result not in (SUCCESS, SKIP, QUIT):
            cypress_command = ["yarn", "cy:run", "--spec", specpath]
            cypress_command.extend(["--reporter", "cypress-circleci-reporter"])
            cypress_command.extend(ctx.cypress_flags)

            click.echo(
                f"{click.style('Running test:', fg='yellow', bold=True)}"
                f"\n{click.style(' '.join(streamlit_command), fg='yellow')}"
                f"\n{click.style(' '.join(cypress_command), fg='yellow')}"
            )

            # Start the streamlit command
            with AsyncSubprocess(streamlit_command, cwd=FRONTEND_DIR) as streamlit_proc:
                # Run the Cypress spec to completion.
                cypress_result = subprocess.run(
                    cypress_command,
                    cwd=FRONTEND_DIR,
                    capture_output=True,
                    text=True,
                )

                # Terminate the streamlit command and get its output
                streamlit_stdout = streamlit_proc.terminate()

            def print_output():
                click.echo(
                    f"\n\n{click.style('Streamlit output:', fg='yellow', bold=True)}"
                    f"\n{streamlit_stdout}"
                    f"\n\n{click.style('Cypress output:', fg='yellow', bold=True)}"
                    f"\n{cypress_result.stdout}"
                    f"\n"
                )

            if cypress_result.returncode == 0:
                result = SUCCESS
                click.echo(click.style("Success!\n", fg="green", bold=True))
                if show_output:
                    print_output()
            else:
                # The test failed. Print the output of the Streamlit command
                # and the Cypress command.
                click.echo(click.style("Failure!", fg="red", bold=True))
                print_output()

                if ctx.always_continue:
                    result = SKIP
                else:
                    # Prompt the user for what to do next.
                    user_input = click.prompt(
                        "[R]etry, [U]pdate snapshots, [S]kip, or [Q]uit?",
                        default="r",
                    )
                    key = user_input[0].lower()
                    if key == "s":
                        result = SKIP
                    elif key == "q":
                        result = QUIT
                    elif key == "r":
                        result = RETRY
                    elif key == "u":
                        ctx.update_snapshots = True
                        result = RETRY
                    else:
                        # Retry if key not recognized
                        result = RETRY

    if result != SUCCESS:
        ctx.any_failed = True

    if result == QUIT:
        raise QuitException()

    return result == SUCCESS


def run_component_template_e2e_test(ctx: Context, template_dir: str, name: str) -> bool:
    """Build a component template and run its e2e tests."""
    frontend_dir = join(template_dir, "frontend")

    # Install the template's npm dependencies into its node_modules.
    subprocess.run(
        ["yarn", "install"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
        check=True,
    )

    # Start the template's dev server.
    with AsyncSubprocess(["yarn", "start"], cwd=frontend_dir) as webpack_proc:
        # Run the test!
        script_path = join(template_dir, "__init__.py")
        spec_path = join(ROOT_DIR, "e2e/specs/component_template.spec.js")

        ctx.cypress_env_vars["COMPONENT_TEMPLATE_TYPE"] = name
        success = run_test(ctx, spec_path, ["streamlit", "run", script_path])
        del ctx.cypress_env_vars["COMPONENT_TEMPLATE_TYPE"]

        webpack_stdout = webpack_proc.terminate()

    if not success:
        click.echo(
            f"{click.style('webpack output:', fg='yellow', bold=True)}"
            f"\n{webpack_stdout}"
            f"\n"
        )

    return success


def is_app_server_alive():
    try:
        r = requests.get("http://localhost:3000/", timeout=3)
        return r.status_code == requests.codes.ok
    except:
        return False


def run_app_server():
    if is_app_server_alive():
        print("Detected React app server already running, won't spawn a new one.")
        return

    env = {
        "BROWSER": "none",  # don't open up chrome, streamlit does this for us
        "BUILD_AS_FAST_AS_POSSIBLE": "true",
        "GENERATE_SOURCEMAP": "false",
        "INLINE_RUNTIME_CHUNK": "false",
    }
    command = ["yarn", "start", "--running-streamlit-e2e-test"]
    proc = AsyncSubprocess(command, cwd=FRONTEND_DIR, env=env)

    print("Starting React app server...")
    proc.start()

    print("Waiting for React app server to come online...")
    start_time = time.time()
    while not is_app_server_alive():
        time.sleep(3)

        # after 10 minutes, we have a problem, just exit
        if time.time() - start_time > 60 * 10:
            print(
                "React app server seems to have had difficulty starting, exiting. Output:"
            )
            print(proc.terminate())
            sys.exit(1)

    print("React app server is alive!")
    return proc


@click.command(
    help=(
        "Run Streamlit e2e tests. If specific tests are specified, only those "
        "tests will be run. If you don't specify specific tests, all tests "
        "will be run."
    )
)
@click.option(
    "-a", "--always-continue", is_flag=True, help="Continue running on test failure."
)
@click.option(
    "-r",
    "--record-results",
    is_flag=True,
    help="Upload video results to the Cypress dashboard. "
    "See https://docs.cypress.io/guides/dashboard/introduction.html for more details.",
)
@click.option(
    "-u",
    "--update-snapshots",
    is_flag=True,
    help="Automatically update snapshots for failing tests.",
)
@click.option(
    "-f",
    "--flaky-tests",
    is_flag=True,
    help="Run tests in 'e2e_flaky' instead of 'e2e'.",
)
@click.option(
    "-v",
    "--verbose",
    is_flag=True,
    help="Show Streamlit and Cypress output.",
)
@click.argument("tests", nargs=-1)
def run_e2e_tests(
    always_continue: bool,
    record_results: bool,
    update_snapshots: bool,
    flaky_tests: bool,
    tests: List[str],
    verbose: bool,
):
    """Run e2e tests. If any fail, exit with non-zero status."""
    kill_streamlits()
    kill_app_servers()
    app_server = run_app_server()

    # Clear reports from previous runs
    remove_if_exists("frontend/test_results/cypress")

    ctx = Context()
    ctx.always_continue = always_continue
    ctx.record_results = record_results
    ctx.update_snapshots = update_snapshots
    ctx.tests_dir_name = "e2e_flaky" if flaky_tests else "e2e"

    try:
        p = Path(join(ROOT_DIR, ctx.tests_dir_name, "specs")).resolve()
        if tests:
            paths = [Path(t).resolve() for t in tests]
        else:
            paths = sorted(p.glob("*.spec.js"))
        for spec_path in paths:
            if basename(spec_path) == "st_hello.spec.js":
                if flaky_tests:
                    continue

                # Test "streamlit hello" in both headless and non-headless mode.
                run_test(
                    ctx,
                    str(spec_path),
                    ["streamlit", "hello", "--server.headless=false"],
                    show_output=verbose,
                )
                run_test(
                    ctx,
                    str(spec_path),
                    ["streamlit", "hello", "--server.headless=true"],
                    show_output=verbose,
                )

            elif basename(spec_path) == "component_template.spec.js":
                if flaky_tests:
                    continue
                for name, template_dir in COMPONENT_TEMPLATE_DIRS.items():
                    run_component_template_e2e_test(ctx, template_dir, name)

            else:
                test_name, _ = splitext(basename(spec_path))
                test_name, _ = splitext(test_name)
                test_path = join(ctx.tests_dir, "scripts", f"{test_name}.py")
                if os.path.exists(test_path):
                    run_test(
                        ctx,
                        str(spec_path),
                        ["streamlit", "run", test_path],
                        show_output=verbose,
                    )
    except QuitException:
        # Swallow the exception we raise if the user chooses to exit early.
        pass
    finally:
        if app_server:
            app_server.terminate()

    if ctx.any_failed:
        sys.exit(1)


if __name__ == "__main__":
    run_e2e_tests()
