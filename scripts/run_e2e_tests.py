#!/usr/bin/env python

# Copyright 2018-2020 Streamlit Inc.
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

from enum import Enum
import time
import functools
import os
import pathlib
import shutil
import signal
import subprocess
import sys
from contextlib import contextmanager
from os.path import dirname, abspath, basename, splitext, join
from tempfile import TemporaryFile
from typing import List
import requests

import click

ROOT_DIR = dirname(dirname(abspath(__file__)))  # streamlit root directory
FRONTEND_DIR = join(ROOT_DIR, "frontend")
COMPONENT_TEMPLATE_DIRS = [
    join(ROOT_DIR, "component-template/template/my_component"),
    join(ROOT_DIR, "component-template/template-reactless/my_component"),
]

CREDENTIALS_FILE = os.path.expanduser("~/.streamlit/credentials.toml")


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

    def poll(self):
        if self._proc is not None:
            return self._proc.poll()

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


def generate_cypress_flags(ctx):
    flags = ["--config", f"integrationFolder={ctx.tests_dir}/specs"]
    if ctx.record_results:
        flags.append("--record")
    if ctx.update_snapshots:
        flags.extend(["--env", "updateSnapshots=true"])
    return flags


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
        self.parallel = False

    @property
    def tests_dir(self) -> str:
        return join(ROOT_DIR, self.tests_dir_name)

    @property
    def cypress_flags(self) -> List[str]:
        """Flags to pass to Cypress"""
        return generate_cypress_flags(self)


def remove_if_exists(path):
    """Remove the given folder or file if it exists"""
    if os.path.isfile(path):
        os.remove(path)
    elif os.path.isdir(path):
        shutil.rmtree(path)


class MoveAsideFile:
    """Move a file aside if it exists; restore it on completion"""

    def __init__(self, path):
        self.path = path
        self.moved = False
        if os.path.exists(path):
            os.rename(path, f"{path}.bak")
            self.moved = True

    def restore(self):
        if self.moved:
            os.rename(f"{self.path}.bak", self.path)


@contextmanager
def move_aside_file(path):
    f = MoveAsideFile(path)
    try:
        yield None
    finally:
        f.restore()


def create_credentials_toml(contents):
    """Writes ~/.streamlit/credentials.toml"""
    os.makedirs(dirname(CREDENTIALS_FILE), exist_ok=True)
    with open(CREDENTIALS_FILE, "w") as f:
        f.write(contents)


def kill_by_pgrep(search_string):
    """Kill any active `streamlit run` processes"""
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
    kill_by_pgrep("streamlit run")


def kill_previous_app_servers():
    kill_by_pgrep("running-streamlit-e2e-test")


def generate_mochawesome_report():
    """Generate the test report. This should be called right before exit."""
    subprocess.run(
        "npx -q mochawesome-merge --reportDir cypress/mochawesome > mochawesome.json",
        cwd=FRONTEND_DIR,
        shell=True,
    )

    subprocess.run(
        "npx -q mochawesome-report-generator mochawesome.json",
        cwd=FRONTEND_DIR,
        shell=True,
    )


def run_test(
    ctx: Context,
    specpath: str,
    streamlit_command: List[str],
    no_credentials: bool = False,
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
    no_credentials : bool
        Any existing ~/.streamlit/credentials.toml file will be moved aside
        for the test, and by default a bare-bones placeholder credentials file
        will be created in its place. But if `no_credentials` is True, the test
        will be run without a credentials file.

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
        if not no_credentials:
            create_credentials_toml('[general]\nemail="test@streamlit.io"')

        # Loop until the test succeeds or is skipped.
        while result not in (SUCCESS, SKIP, QUIT):
            cypress_command = ["yarn", "cy:run", "--spec", specpath]
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

            if cypress_result.returncode == 0:
                result = SUCCESS
                click.echo(click.style("Success!\n", fg="green", bold=True))
            else:
                # The test failed. Print the output of the Streamlit command
                # and the Cypress command.
                click.echo(
                    f"{click.style('Failure!', fg='red', bold=True)}"
                    f"\n\n{click.style('Streamlit output:', fg='yellow', bold=True)}"
                    f"\n{streamlit_stdout}"
                    f"\n\n{click.style('Cypress output:', fg='yellow', bold=True)}"
                    f"\n{cypress_result.stdout}"
                    f"\n"
                )

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


def run_component_template_e2e_test(ctx: Context, template_dir: str) -> bool:
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
        success = run_test(ctx, spec_path, ["streamlit", "run", script_path])

        webpack_stdout = webpack_proc.terminate()

    if not success:
        click.echo(
            f"{click.style('webpack output:', fg='yellow', bold=True)}"
            f"\n{webpack_stdout}"
            f"\n"
        )

    return success


class TestResult(Enum):
    SUCCESS = 0
    FAILURE = 1
    PENDING = 2


class TestRunner:
    def __init__(self, app_port: int, streamlit_port: int):
        """
        Basically a non-blocking version of run_test.

        Parameters
        ----------
        streamlit_port : str
            Port to run Streamlit server on.
        app_port : str
            Port specifying React app server to point Cypress tests toward.
        """

        self.ready = True
        self.streamlit_port = str(streamlit_port)
        self.app_port = str(app_port)
        self.maf = None

        self.streamlit_proc = None
        self.cypress_proc = None

    def start(
        self, specpath: str, streamlit_command: List[str], cypress_flags: List[str]
    ):
        """
        Starts a test, leaves it running in the background, returns.

        Parameters
        ----------
        specpath : str
            The path of the Cypress spec file to run.
        streamlit_command : list of str
            The Streamlit command to run.
        cypress_flags : list of str
            A list of flags to pass to Cypress.
        """

        self.maf = MoveAsideFile(CREDENTIALS_FILE)
        create_credentials_toml('[general]\nemail="test@streamlit.io"')

        streamlit_command.extend(["--server.port", self.streamlit_port])
        streamlit_command.extend(["--global.testMode", "true"])

        cypress_command = ["yarn", "cy:run", "--spec", specpath]
        cypress_command.extend(["--env", f"APP_PORT={self.app_port}"])
        cypress_command.extend(cypress_flags)

        click.echo(
            f"{click.style('Running test:', fg='yellow', bold=True)}"
            f"\n{click.style(' '.join(streamlit_command), fg='yellow')}"
            f"\n{click.style(' '.join(cypress_command), fg='yellow')}"
        )

        self.streamlit_proc = AsyncSubprocess(streamlit_command, cwd=FRONTEND_DIR)
        self.cypress_proc = AsyncSubprocess(cypress_command, cwd=FRONTEND_DIR)
        self.streamlit_proc.start()
        self.cypress_proc.start()
        self.ready = False

    def terminate(self):
        if self.streamlit_proc:
            self.streamlit_proc.terminate()
        if self.cypress_proc:
            self.cypress_proc.terminate()

    def check_finished(self) -> TestResult:
        returncode = self.cypress_proc.poll()
        if returncode is None:
            return TestResult.PENDING

        streamlit_stdout = self.streamlit_proc.terminate()
        cypress_stdout = self.cypress_proc.terminate()

        self.streamlit_proc = None
        self.cypress_proc = None

        ret = TestResult.FAILURE
        if returncode == 0:
            ret = TestResult.SUCCESS
            click.echo(click.style("Success!\n", fg="green", bold=True))
        else:
            click.echo(
                f"{click.style('Failure!', fg='red', bold=True)}"
                f"\n\n{click.style('Streamlit output:', fg='yellow', bold=True)}"
                f"\n{streamlit_stdout}"
                f"\n\n{click.style('Cypress output:', fg='yellow', bold=True)}"
                f"\n{cypress_result.stdout}"
                f"\n"
            )

        self.maf.restore()
        self.ready = True
        return ret


def check_url_online(url):
    try:
        r = requests.get(url, timeout=5)
        return r.status_code == 200
    except:
        pass


class ParallelRunner:
    def __init__(self):
        self.node_servers = []
        self.runners = []

    def run(self, tests, count):
        try:
            return self.actually_run(tests, count)
        finally:
            for proc in self.node_servers:
                proc.terminate()
            for runner in self.runners:
                runner.terminate()

    def actually_run(self, tests, count):
        app_ports = range(3000, 3000 + count)
        st_ports = range(8501, 8501 + count)

        # spawn app servers
        for app_port, streamlit_port in zip(app_ports, st_ports):
            env = {
                "PORT": str(app_port),
                "REACT_APP_WEBSOCKET_PORT": str(streamlit_port),
                "BROWSER": "none",  # don't open up chrome, streamlit does this for us
            }
            proc = AsyncSubprocess(
                ["yarn", "start", "--running-streamlit-e2e-test"],
                cwd=FRONTEND_DIR,
                env=env,
            )
            proc.start()
            self.node_servers.append(proc)

        # wait for app servers to be running
        print("Waiting for React app servers...")
        ports_remaining = set(app_ports)
        while ports_remaining:
            try:
                for port in list(ports_remaining):
                    if check_url_online(f"http://localhost:{port}/"):
                        print(f"Port {port} is alive!")
                        ports_remaining.remove(port)
                time.sleep(2)
            except KeyboardInterrupt:
                print("Ctrl-C pressed.")
                return
        print("React app servers all alive.")

        # run our tests
        self.runners = [TestRunner(n, st) for n, st in zip(app_ports, st_ports)]

        def is_runner_ready(runner):
            if runner.ready:
                return True
            if runner.check_finished() != TestResult.PENDING:
                return True

        def find_available_runner():
            while True:
                for runner in self.runners:
                    if is_runner_ready(runner):
                        return runner
                time.sleep(5)

        for args in tests:
            find_available_runner().start(*args)

        # wait for last round of runners to finish
        while not all(is_runner_ready(it) for it in self.runners):
            time.sleep(5)


@click.command()
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
    "-t",
    "--test",
    help="Run a specific test, e.g. '--test st_markdown'",
    type=str,
)
@click.option(
    "-p",
    "--parallel",
    help="Specifies a number of parallel test instances to run. "
    "This flag also causes the test runner to spin up its own Node servers.",
    type=int,
    default=0,
)
def run_e2e_tests(
    always_continue: bool,
    record_results: bool,
    update_snapshots: bool,
    flaky_tests: bool,
    test: str,
    parallel: int,
):
    """Run e2e tests. If any fail, exit with non-zero status."""
    kill_streamlits()

    # Clear reports from previous runs
    remove_if_exists("frontend/cypress/mochawesome")
    remove_if_exists("frontend/mochawesome-report")
    remove_if_exists("frontend/mochawesome.json")

    ctx = Context()
    ctx.always_continue = always_continue
    ctx.record_results = record_results
    ctx.update_snapshots = update_snapshots
    ctx.tests_dir_name = "e2e_flaky" if flaky_tests else "e2e"

    try:
        # First, test "streamlit hello" in different combinations. We skip
        # `no_credentials=True` for the `--server.headless=false` test, because
        # it'll give a credentials prompt.
        """
        if (not flaky_tests) and (not test):
            hello_spec = join(ROOT_DIR, "e2e/specs/st_hello.spec.js")
            run_test(
                ctx,
                hello_spec,
                ["streamlit", "hello", "--server.headless=true"],
                no_credentials=False,
            )
            run_test(ctx, hello_spec, ["streamlit", "hello", "--server.headless=false"])
            run_test(ctx, hello_spec, ["streamlit", "hello", "--server.headless=true"])

            # Next, run our component_template tests.
            for template_dir in COMPONENT_TEMPLATE_DIRS:
                run_component_template_e2e_test(ctx, template_dir)
        """

        # Test core streamlit elements

        def generate_test_calls():
            p = pathlib.Path(join(ROOT_DIR, ctx.tests_dir_name, "scripts")).resolve()
            paths = [p / f"{test}.py"] if test else sorted(p.glob("*.py"))
            for test_path in paths:
                test_name, _ = splitext(basename(test_path.as_posix()))
                specpath = join(ctx.tests_dir, "specs", f"{test_name}.spec.js")
                yield ctx, specpath, ["streamlit", "run", test_path.as_posix()]

        def generate_parallel_test_calls():
            for ctx, specpath, streamlit_command in generate_test_calls():
                cypress_flags = generate_cypress_flags(ctx)
                yield specpath, streamlit_command, cypress_flags

        if parallel > 0:
            kill_previous_app_servers()
            ParallelRunner().run(generate_parallel_test_calls(), parallel)
        else:
            for args in generate_test_calls():
                run_test(*args)

    except QuitException:
        # Swallow the exception we raise if the user chooses to exit early.
        pass
    finally:
        generate_mochawesome_report()

    if ctx.any_failed:
        sys.exit(1)


if __name__ == "__main__":
    run_e2e_tests()
