#!/usr/bin/env python
# Copyright 2018-2022 Streamlit Inc.
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
import signal
import subprocess
import time
from typing import Optional

import pytest


CONFIG_FILE_PATH: str
CREDENTIALS_FILE_PATH: str
REPO_ROOT: str
STREAMLIT_RELEASE_VERSION: Optional[str]


class TestCLIRegressions:
    """Suite of CLI regression tests to be run against a release build of the Streamlit library.

    Before running, ensure that you have:
        - An isolated environment with Streamlit installed in production mode (not development) as
          well as pytest. This can include the current version, nightly, or local build/wheel, like
          one of the following:
                pip install streamlit-nightly=[nightly tag]
                pip install lib/dist/<WHEEL_FILE>
                pip install streamlit
        - The STREAMLIT_RELEASE_VERSION environment variable must be set, such as:
                export STREAMLIT_RELEASE_VERSION=1.5.1

    You can then run the tests from the root of the Streamlit repository using one of the following:
            pytest scripts/cli_regression_tests.py
            make cli-regression-tests

    This test suite makes use of Python's built-in assert statement. Note that assertions in the
    form of `assert <expression>` use Pytest's assertion introspection. In some cases, a more clear
    error message is specified manually by using `assert <expression>, <message>`. See
    https://docs.pytest.org/en/7.0.x/how-to/assert.html#assert-details for more details.
    """

    @pytest.fixture(scope="module", autouse=True)
    def setup(self):
        # ---- Initialization
        global CONFIG_FILE_PATH
        CONFIG_FILE_PATH = os.path.expanduser("~/.streamlit/config.toml")

        global CREDENTIALS_FILE_PATH
        CREDENTIALS_FILE_PATH = os.path.expanduser("~/.streamlit/credentials.toml")

        global REPO_ROOT
        REPO_ROOT = os.getcwd()

        global STREAMLIT_RELEASE_VERSION
        STREAMLIT_RELEASE_VERSION = os.environ.get("STREAMLIT_RELEASE_VERSION", None)

        # Ensure that there aren't any previously stored credentials
        if os.path.exists(CREDENTIALS_FILE_PATH):
            os.remove(CREDENTIALS_FILE_PATH)

        yield  # Run tests

        # ---- Tear Down
        # Remove testing credentials
        if os.path.exists(CREDENTIALS_FILE_PATH):
            os.remove(CREDENTIALS_FILE_PATH)

        if os.path.exists(CONFIG_FILE_PATH):
            os.remove(CONFIG_FILE_PATH)

        self.run_command("streamlit cache clear")

    def parameterize(self, params):
        return params.split(" ")

    def read_process_output(self, proc, num_lines_to_read):
        num_lines_read = 0
        output = ""

        while num_lines_read < num_lines_to_read:
            output += proc.stdout.readline().decode("UTF-8")
            num_lines_read += 1

        return output

    def run_command(self, command):
        return subprocess.check_output(self.parameterize(command)).decode("UTF-8")

    def run_single_proc(self, command, num_lines_to_read=4):
        proc = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setpgrp,
        )

        output = self.read_process_output(proc, num_lines_to_read)

        try:
            os.kill(os.getpgid(proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            # The process may have exited already. If so, we don't need to do anything
            pass

        return output

    def run_double_proc(
        self, command_one, command_two, wait_in_seconds=2, num_lines_to_read=4
    ):
        proc_one = subprocess.Popen(
            command_one,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setpgrp,
        )

        # Quick sleep to ensure that proc_one gets started first
        time.sleep(0.1)

        proc_two = subprocess.Popen(
            command_two,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setpgrp,
        )

        output_one = self.read_process_output(proc_one, num_lines_to_read)
        output_two = self.read_process_output(proc_two, num_lines_to_read)

        try:
            os.killpg(os.getpgid(proc_one.pid), signal.SIGKILL)
            os.killpg(os.getpgid(proc_two.pid), signal.SIGKILL)
        except ProcessLookupError:
            # The process may have exited already. If so, we don't need to do anything
            pass

        return output_one, output_two

    @pytest.mark.skipif(
        bool(os.environ.get("SKIP_VERSION_CHECK", False)) == True,
        reason="Skip version verification when `SKIP_VERSION_CHECK` env var is set",
    )
    def test_streamlit_version(self):
        assert (
            STREAMLIT_RELEASE_VERSION != None and STREAMLIT_RELEASE_VERSION != ""
        ), "You must set the $STREAMLIT_RELEASE_VERSION env variable"
        assert STREAMLIT_RELEASE_VERSION in self.run_command(
            "streamlit version"
        ), f"Package version does not match the desired version of {STREAMLIT_RELEASE_VERSION}"

    def test_streamlit_activate(self):
        process = subprocess.Popen(
            "streamlit activate", stdin=subprocess.PIPE, shell=True
        )
        process.stdin.write(b"regressiontest@streamlit.io\n")  # type: ignore
        process.stdin.flush()  # type: ignore
        process.communicate()

        with open(CREDENTIALS_FILE_PATH) as f:
            assert (
                "regressiontest@streamlit.io" in f.read()
            ), "Email address was not found in the credentials file"

    def test_port_reassigned(self):
        """When starting a new Streamlit session, it will run on port 8501 by default. If 8501 is
        not available, it will use the next available port.
        """

        out_one, out_two = self.run_double_proc(
            f"streamlit run --server.headless=true {REPO_ROOT}/examples/file_uploader.py",
            f"streamlit run --server.headless=true {REPO_ROOT}/examples/file_uploader.py",
        )

        assert ":8501" in out_one, f"Incorrect port. See output:\n{out_one}"
        assert ":8502" in out_two, f"Incorrect port. See output:\n{out_two}"

    def test_conflicting_port(self):
        out_one, out_two = self.run_double_proc(
            f"streamlit run --server.headless=true {REPO_ROOT}/examples/file_uploader.py",
            f"streamlit run --server.headless=true --server.port=8501 {REPO_ROOT}/examples/file_uploader.py",
        )

        assert ":8501" in out_one, f"Incorrect port. See output:\n{out_one}"
        assert (
            "Port 8501 is already in use" in out_two
        ), f"Incorrect conflict. See output:\n{out_one}"

    def test_cli_defined_port(self):
        out = self.run_single_proc(
            f"streamlit run --server.headless=true --server.port=9999 {REPO_ROOT}/examples/file_uploader.py",
        )

        assert ":9999" in out, f"Incorrect port. See output:\n{out}"

    def test_config_toml_defined_port(self):
        with open(CONFIG_FILE_PATH, "w") as file:
            file.write("[server]\n  port=8888")

        out = self.run_single_proc(
            f"streamlit run --server.headless=true {REPO_ROOT}/examples/file_uploader.py",
        )

        assert ":8888" in out, f"Incorrect port. See output:\n{out}"
