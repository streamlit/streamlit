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

import os
import pathlib
import shutil
import signal
import subprocess
import sys
from contextlib import contextmanager
from os.path import dirname, abspath, basename, splitext, join
from typing import List

import click

ROOT_DIR = dirname(dirname(abspath(__file__)))  # streamlit root directory
FRONTEND_DIR = join(ROOT_DIR, "frontend")

CREDENTIALS_FILE = os.path.expanduser("~/.streamlit/credentials.toml")


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

    @property
    def tests_dir(self) -> str:
        return join(ROOT_DIR, self.tests_dir_name)

    @property
    def record_results_flag(self) -> str:
        if self.record_results:
            return "--record"
        return ""

    @property
    def snapshots_flags(self) -> List[str]:
        if self.update_snapshots:
            return ["--env", "updateSnapshots=true"]
        return []


def remove_if_exists(path):
    """Removes the given folder or file if it exists"""
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


def create_credentials(contents):
    """Writes ~/.streamlit/credentials.toml"""
    # Ensure our parent directory exists
    os.makedirs(dirname(CREDENTIALS_FILE), exist_ok=True)

    with open(CREDENTIALS_FILE, "w") as f:
        f.write(contents)


def kill_streamlits():
    """Kill any active `streamlit run` processes"""
    result = subprocess.run(
        "pgrep -f 'streamlit run'",
        shell=True,
        universal_newlines=True,
        capture_output=True,
    )

    if result.returncode == 0:
        for pid in result.stdout.split():
            try:
                os.kill(int(pid), signal.SIGTERM)
            except Exception as e:
                print("Failed to kill Streamlit instance", e)


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


def run_test(ctx: Context, *args: str):
    # Convert our args from tuple to list, because we may mutate it.
    args = list(args)

    if args[0] == "run":
        file = args[1]
        filename, _ = splitext(basename(file))
        specpath = join(ctx.tests_dir, "specs", f"{filename}.spec.ts")
    else:
        specpath = join(ROOT_DIR, "e2e/specs/st_hello.spec.ts")

    # Infinite loop to support retries
    while True:
        # Run the next Streamlit test script
        streamlit_proc = subprocess.Popen(
            ["streamlit"] + args, universal_newlines=True, cwd=FRONTEND_DIR,
        )

        # Run the Cypress spec
        cypress_command = [
            "yarn",
            "cy:run",
            "--spec",
            specpath,
            "--config",
            f"integrationFolder={ctx.tests_dir}/specs",
            ctx.record_results_flag,
        ] + ctx.snapshots_flags

        cypress_result = subprocess.run(
            cypress_command, universal_newlines=True, cwd=FRONTEND_DIR,
        )

        # Kill the Streamlit script
        streamlit_proc.terminate()

        # If exit code is non-zero, prompt user to continue;
        # else continue without prompting
        if cypress_result.returncode != 0 and not ctx.always_continue:
            key = input("[R]etry, [U]pdate snapshots, [S]kip, or [Q]uit?")[0].lower()
            if key == "s":
                break
            elif key == "q":
                ctx.any_failed = True
                raise RuntimeError("Terminating early")
            elif key == "r":
                continue
            elif key == "u":
                ctx.update_snapshots = True
                continue
            else:
                # Retry if key not recognized
                continue
        elif cypress_result.returncode != 0 and ctx.always_continue:
            ctx.any_failed = True

        # If we got to this point, break out of the infinite loop.
        break


@click.command()
@click.option(
    "-a", "--always-continue", is_flag=True, help="Continue running on test failure."
)
@click.option(
    "-r",
    "--record-results",
    is_flag=True,
    help="Record video results in the Cypress dashboard.",
)
@click.option(
    "-u",
    "--update-snapshots",
    is_flag=True,
    help="Automatically update snapshots for failing tests.",
)
@click.option(
    "-f", "--tests-folder", default="e2e", help="Parent folder of specs and scripts."
)
def run_e2e_tests(
    always_continue: bool,
    record_results: bool,
    update_snapshots: bool,
    tests_folder: str,
):
    """Run e2e tests. If any fail, exit with non-zero status."""
    kill_streamlits()

    # Clear reports from previous runs
    remove_if_exists("frontend/cypress/mochawesome")
    remove_if_exists("frontend/mochawesome.json")

    ctx = Context()
    ctx.always_continue = always_continue
    ctx.record_results = record_results
    ctx.update_snapshots = update_snapshots
    ctx.tests_dir_name = tests_folder

    # Move existing credentials file aside for these tests; we'll be
    # manipulating it.
    with move_aside_file(CREDENTIALS_FILE):
        try:
            # First, test "streamlit hello" in different combinations. We skip
            # the credential-less '--server.headless=false' because it'll
            # give a credentials prompt.

            # run_test(ctx, "hello", "--server.headless=false")
            run_test(ctx, "hello", "--server.headless=true")

            create_credentials('[general]\nemail="test@streamlit.io"')

            run_test(ctx, "hello", "--server.headless=false")
            run_test(ctx, "hello", "--server.headless=true")

            # Test core streamlit elements
            p = pathlib.Path(join(ROOT_DIR, ctx.tests_dir_name, "scripts")).resolve()
            for file in p.glob("*.py"):
                run_test(ctx, "run", str(file))
        finally:
            generate_mochawesome_report()

    if ctx.any_failed:
        sys.exit(1)


if __name__ == "__main__":
    run_e2e_tests()
