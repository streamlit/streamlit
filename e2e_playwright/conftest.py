# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Global pytest fixtures for e2e tests.
This file is automatically run by pytest before tests are executed.
"""
from __future__ import annotations

import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path
from random import randint
from tempfile import TemporaryFile
from types import ModuleType
from typing import Any, Generator, List, Literal, Protocol

import pytest
import requests
from PIL import Image
from playwright.sync_api import ElementHandle, Locator, Page
from pytest import FixtureRequest


class AsyncSubprocess:
    """A context manager. Wraps subprocess. Popen to capture output safely."""

    def __init__(self, args, cwd=None, env=None):
        self.args = args
        self.cwd = cwd
        self.env = env or {}
        self._proc = None
        self._stdout_file = None

    def terminate(self):
        """Terminate the process and return its stdout/stderr in a string."""
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
        print(f"Running: {shlex.join(self.args)}")
        self._proc = subprocess.Popen(
            self.args,
            cwd=self.cwd,
            stdout=self._stdout_file,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ.copy(), **self.env},
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._proc is not None:
            self._proc.terminate()
            self._proc = None
        if self._stdout_file is not None:
            self._stdout_file.close()
            self._stdout_file = None


def resolve_test_to_script(test_module: ModuleType) -> str:
    """Resolve the test module to the corresponding test script filename."""
    assert test_module.__file__ is not None
    return test_module.__file__.replace("_test.py", ".py")


def is_port_available(port: int, host: str) -> bool:
    """Check if a port is available on the given host."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) != 0


def find_available_port(
    min_port: int = 10000,
    max_port: int = 65535,
    max_tries: int = 50,
    host: str = "localhost",
) -> int:
    """Find an available port on the given host."""
    for _ in range(max_tries):
        selected_port = randint(min_port, max_port)
        if is_port_available(selected_port, host):
            return selected_port
    raise RuntimeError("Unable to find an available port.")


# TODO(lukasmasuch): This was the previous method to rely on the OS to find a free port.
# but when running the tests in parallel, it can happen that the OS assigns the same port
# to multiple tests. This is why we now use the find_available_port method above.

# def find_available_port(host: str = "localhost") -> int:
#     """Find an available port on the given host."""
#     with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
#         s.bind((host, 0))  # 0 means that the OS chooses a random port
#         s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
#         return int(s.getsockname()[1])  # [1] contains the randomly selected port number


def is_app_server_running(port: int, host: str = "localhost") -> bool:
    """Check if the app server is running."""
    try:
        return (
            requests.get(f"http://{host}:{port}/_stcore/health", timeout=1).text == "ok"
        )
    except Exception:
        return False


def wait_for_app_server_to_start(port: int, timeout: int = 5) -> bool:
    """Wait for the app server to start.

    Parameters
    ----------
    port : int
        The port on which the app server is running.

    timeout : int
        The number of minutes to wait for the app server to start.

    Returns
    -------
    bool
        True if the app server is started, False otherwise.
    """

    print(f"Waiting for app to start... {port}")
    start_time = time.time()
    while not is_app_server_running(port):
        time.sleep(3)
        if time.time() - start_time > 60 * timeout:
            return False
    return True


def wait_for_app_run(page: Page, wait_delay: int = 100):
    """Wait for the given page to finish running."""
    page.wait_for_selector(
        "[data-testid='stStatusWidget']", timeout=20000, state="detached"
    )

    if wait_delay > 0:
        # Give the app a little more time to render everything
        page.wait_for_timeout(wait_delay)


def wait_for_app_loaded(page: Page):
    """Wait for the app to fully load."""
    # Wait for the app view container to appear:
    page.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )
    # Wait for the main app container to appear:
    page.wait_for_selector(
        "[data-testid='block-container']", timeout=20000, state="attached"
    )
    # Wait for the main menu to appear:
    page.wait_for_selector("#MainMenu", timeout=20000, state="attached")
    wait_for_app_run(page)


@pytest.fixture(scope="module")
def app_port() -> int:
    """Fixture that returns an available port on localhost."""
    return find_available_port()


@pytest.fixture(scope="module", autouse=True)
def app_server(
    app_port: int, request: FixtureRequest
) -> Generator[AsyncSubprocess, None, None]:
    """Fixture that starts and stops the Streamlit app server."""
    streamlit_proc = AsyncSubprocess(
        [
            "streamlit",
            "run",
            resolve_test_to_script(request.module),
            "--server.headless",
            "true",
            "--global.developmentMode",
            "false",
            "--server.port",
            str(app_port),
            "--browser.gatherUsageStats",
            "false",
        ],
        cwd=".",
    )
    streamlit_proc.start()
    if not wait_for_app_server_to_start(app_port):
        streamlit_stdout = streamlit_proc.terminate()
        print(streamlit_stdout)
        raise RuntimeError("Unable to start Streamlit app")
    yield streamlit_proc
    streamlit_stdout = streamlit_proc.terminate()
    print(streamlit_stdout)


@pytest.fixture(scope="function")
def app(page: Page, app_port: int) -> Page:
    """Fixture that opens the app."""
    page.goto(f"http://localhost:{app_port}/")
    wait_for_app_loaded(page)
    return page


@pytest.fixture(scope="function", params=["light_theme", "dark_theme"])
def app_theme(request) -> str:
    """Fixture that returns the theme name."""
    return str(request.param)


@pytest.fixture(scope="function")
def themed_app(page: Page, app_port: int, app_theme: str) -> Page:
    """Fixture that opens the app with the given theme."""
    page.goto(f"http://localhost:{app_port}/?embed_options={app_theme}")
    wait_for_app_loaded(page)
    return page


class ImageCompareFunction(Protocol):
    def __call__(
        self,
        element: ElementHandle | Locator | Page,
        *,
        image_threshold: float = 0.002,
        pixel_threshold: float = 0.05,
        name: str | None = None,
        fail_fast: bool = False,
    ) -> None:
        """Compare a screenshot with screenshot from a past run.

        Parameters
        ----------
        element : ElementHandle or Locator
            The element to take a screenshot of.
        image_threshold : float, optional
            The allowed percentage of different pixels in the image.
        pixel_threshold : float, optional
            The allowed percentage of difference for a single pixel.
        name : str | None, optional
            The name of the screenshot without an extension. If not provided, the name
            of the test function will be used.
        fail_fast : bool, optional
            If True, the comparison will stop at the first pixel mismatch.
        """


@pytest.fixture(scope="session")
def output_folder(pytestconfig: Any) -> Path:
    """Fixture that returns the directory that is used for all test failures information.

    This includes:
    - snapshot-tests-failures: This directory contains all the snapshots that did not
    match with the snapshots from past runs. The folder structure is based on the folder
    structure used in the main snapshots folder.
    - snapshot-updates: This directory contains all the snapshots that got updated in
    the current run based on folder structure used in the main snapshots folder.
    """
    return Path(pytestconfig.getoption("--output")).resolve()


@pytest.fixture(scope="function")
def assert_snapshot(
    request: FixtureRequest, output_folder: Path
) -> Generator[ImageCompareFunction, None, None]:
    """Fixture that compares a screenshot with screenshot from a past run."""
    root_path = Path(os.getcwd()).resolve()
    platform = str(sys.platform)
    # TODO(lukasmasuch): Is there a better way to get the module name?
    module_name = request.module.__name__.split(".")[-1]
    test_function_name = request.node.originalname

    snapshot_dir: Path = root_path / "__snapshots__" / platform / module_name

    module_snapshot_failures_dir: Path = (
        output_folder / "snapshot-tests-failures" / platform / module_name
    )
    module_snapshot_updates_dir: Path = (
        output_folder / "snapshot-updates" / platform / module_name
    )

    snapshot_file_suffix = ""
    # Extract the parameter ids if they exist
    match = re.search(r"\[(.*?)\]", request.node.name)
    if match:
        snapshot_file_suffix = f"[{match.group(1)}]"

    snapshot_default_file_name: str = test_function_name + snapshot_file_suffix

    test_failure_messages: List[str] = []

    def compare(
        element: ElementHandle | Locator | Page,
        *,
        image_threshold: float = 0.002,
        pixel_threshold: float = 0.05,
        name: str | None = None,
        fail_fast: bool = False,
        file_type: Literal["png", "jpg"] = "png",
    ) -> None:
        """Compare a screenshot with screenshot from a past run.

        Parameters
        ----------
        element : ElementHandle or Locator
            The element to take a screenshot of.
        image_threshold : float, optional
            The allowed percentage of different pixels in the image.
        pixel_threshold : float, optional
            The allowed percentage of difference for a single pixel to be considered
            different.
        name : str | None, optional
            The name of the screenshot without an extension. If not provided, the name
            of the test function will be used.
        fail_fast : bool, optional
            If True, the comparison will stop at the first pixel mismatch.
        file_type: "png" or "jpg"
            The file type of the screenshot. Defaults to "png".
        """
        nonlocal test_failure_messages
        nonlocal snapshot_default_file_name
        nonlocal module_snapshot_updates_dir
        nonlocal module_snapshot_failures_dir
        nonlocal snapshot_file_suffix

        if file_type == "jpg":
            file_extension = ".jpg"
            img_bytes = element.screenshot(
                type="jpeg", quality=90, animations="disabled"
            )

        else:
            file_extension = ".png"
            img_bytes = element.screenshot(type="png", animations="disabled")

        snapshot_file_name: str = snapshot_default_file_name
        if name:
            snapshot_file_name = name + snapshot_file_suffix

        snapshot_file_path: Path = (
            snapshot_dir / f"{snapshot_file_name}{file_extension}"
        )

        snapshot_updates_file_path: Path = (
            module_snapshot_updates_dir / f"{snapshot_file_name}{file_extension}"
        )

        snapshot_file_path.parent.mkdir(parents=True, exist_ok=True)

        test_failures_dir = module_snapshot_failures_dir / snapshot_file_name
        if test_failures_dir.exists():
            # Remove the past runs failure dir for this specific screenshot
            shutil.rmtree(test_failures_dir)

        if not snapshot_file_path.exists():
            snapshot_file_path.write_bytes(img_bytes)
            # Update this in updates folder:
            snapshot_updates_file_path.parent.mkdir(parents=True, exist_ok=True)
            snapshot_updates_file_path.write_bytes(img_bytes)
            # For missing snapshots, we don't want to directly fail in order to generate
            # all missing snapshots in one run.
            test_failure_messages.append(f"Missing snapshot for {snapshot_file_name}")
            return

        from pixelmatch.contrib.PIL import pixelmatch

        # Compare the new screenshot with the screenshot from past runs:
        img_a = Image.open(BytesIO(img_bytes))
        img_b = Image.open(snapshot_file_path)
        img_diff = Image.new("RGBA", img_a.size)
        try:
            mismatch = pixelmatch(
                img_a,
                img_b,
                img_diff,
                threshold=pixel_threshold,
                fail_fast=fail_fast,
                alpha=0,
            )
        except ValueError as ex:
            # ValueError is thrown when the images have different sizes
            # Update this in updates folder:
            snapshot_updates_file_path.parent.mkdir(parents=True, exist_ok=True)
            snapshot_updates_file_path.write_bytes(img_bytes)
            pytest.fail(f"Snapshot matching for {snapshot_file_name} failed: {ex}")
        max_diff_pixels = int(image_threshold * img_a.size[0] * img_a.size[1])

        if mismatch < max_diff_pixels:
            return

        # Update this in updates folder:
        snapshot_updates_file_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_updates_file_path.write_bytes(img_bytes)

        # Create new failures folder for this test:
        test_failures_dir.mkdir(parents=True, exist_ok=True)
        img_diff.save(f"{test_failures_dir}/diff_{snapshot_file_name}{file_extension}")
        img_a.save(f"{test_failures_dir}/actual_{snapshot_file_name}{file_extension}")
        img_b.save(f"{test_failures_dir}/expected_{snapshot_file_name}{file_extension}")

        pytest.fail(
            f"Snapshot mismatch for {snapshot_file_name} ({mismatch} pixels difference)"
        )

    yield compare

    if test_failure_messages:
        pytest.fail("Missing snapshots: \n" + "\n".join(test_failure_messages))
