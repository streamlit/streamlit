import os
import shutil
import socket
import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path
from random import randint
from tempfile import TemporaryFile
from typing import Any, Callable

import pytest
import requests
from PIL import Image
from pixelmatch.contrib.PIL import pixelmatch
from playwright.sync_api import BrowserType, Page, TimeoutError, expect


@pytest.fixture
def assert_snapshot(request: Any, browser_name: str) -> Callable:
    test_name = f"{str(Path(request.node.name))}[{str(sys.platform)}]"
    test_dir = str(Path(request.node.name)).split("[", 1)[0]

    def compare(
        img: bytes, *, threshold: float = 0.1, name=f"{test_name}.png", fail_fast=False
    ) -> None:
        test_file_name = str(os.path.basename(Path(request.node.fspath))).strip(".py")
        filepath = (
            Path(request.node.fspath).parent.resolve()
            / "snapshots"
            / test_file_name
            / test_dir
        )
        filepath.mkdir(parents=True, exist_ok=True)
        file = filepath / name
        # Create a dir where all snapshot test failures will go
        results_dir_name = (
            Path(request.node.fspath).parent.resolve() / "snapshot_tests_failures"
        )
        test_results_dir = results_dir_name / test_file_name / test_name
        # Remove a single test's past run dir with actual, diff and expected images
        if test_results_dir.exists():
            shutil.rmtree(test_results_dir)
        if not file.exists():
            file.write_bytes(img)
            print("--> New snapshot(s) created. Please review images")
        img_a = Image.open(BytesIO(img))
        img_b = Image.open(file)
        img_diff = Image.new("RGBA", img_a.size)
        mismatch = pixelmatch(
            img_a, img_b, img_diff, threshold=threshold, fail_fast=fail_fast
        )
        if mismatch == 0:
            return
        else:
            # Create new test_results folder
            test_results_dir.mkdir(parents=True, exist_ok=True)
            img_diff.save(f"{test_results_dir}/Diff_{name}")
            img_a.save(f"{test_results_dir}/Actual_{name}")
            img_b.save(f"{test_results_dir}/Expected_{name}")
            pytest.fail("--> Snapshots DO NOT match!")

    return compare


def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) != 0


def get_available_port(
    min_port: int = 10000, max_port: int = 65535, max_tries: int = 50
) -> int:
    for _ in range(max_tries):
        selected_port = randint(min_port, max_port)
        if is_port_available("localhost", selected_port):
            return selected_port
    raise RuntimeError("Unable to find an available port")


def is_app_running(port: int) -> bool:
    try:
        return requests.get(f"http://localhost:{port}/", timeout=1).status_code == 200
    except Exception:
        return False


def wait_for_app_to_start(port: int, timeout: int = 5) -> bool:
    print(f"Waiting for app to start... {port}")
    start_time = time.time()
    while not is_app_running(port):
        time.sleep(3)
        if time.time() - start_time > 60 * timeout:
            return False
    return True


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
        print(f"Running: {self.args}")
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


def wait_for_script_finish(page: Page):
    # Wait until we know the script has started.
    page.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=20000, state="attached"
    )

    # Check that "Please wait..." does not exist within the 'stAppViewContainer'
    app_view_container = page.query_selector("[data-testid='stAppViewContainer']")
    if (
        app_view_container
        and app_view_container.inner_text().find("Please wait...") != -1
    ):
        raise AssertionError("Found 'Please wait...' inside the stAppViewContainer")
    # Wait until the script is no longer running.
    status_widget = page.wait_for_selector(
        "[data-testid='stStatusWidget']", timeout=20000, state="attached"
    )
    if not status_widget:
        raise AssertionError("Unable to find stStatusWidget")
    status_widget.wait_for_element_state("hidden", timeout=20000)
    # Give the app a little more time to render everything
    time.sleep(0.5)


@pytest.fixture(scope="module", autouse=True)
def port() -> int:
    port = get_available_port()
    return port


@pytest.fixture(scope="module", autouse=True)
def before_all_after_all(port: int):
    streamlit_proc = AsyncSubprocess(
        [
            "streamlit",
            "run",
            "st_arrow_dataframe_column_types.py",
            "--server.headless",
            "true",
            "--global.developmentMode",
            "false",
            "--server.port",
            str(port),
            "--browser.gatherUsageStats",
            "false",
        ],
        cwd=".",
    )
    streamlit_proc.start()
    if not wait_for_app_to_start(port):
        streamlit_stdout = streamlit_proc.terminate()
        print(streamlit_stdout)
        raise RuntimeError("Unable to start Streamlit app")
    yield port
    streamlit_stdout = streamlit_proc.terminate()
    print(streamlit_stdout)


@pytest.fixture(scope="function")
def app(page: Page, port: int):
    page.goto(f"http://localhost:{port}/")
    wait_for_script_finish(page)
    yield page


@pytest.fixture(scope="function", params=["light_theme", "dark_theme"])
def app_theme(request) -> str:
    return str(request.param)


@pytest.fixture(scope="function")
def themed_app(page: Page, port: int, app_theme: str):
    page.goto(f"http://localhost:{port}/?embed_options={app_theme}")
    wait_for_script_finish(page)
    yield page


# @pytest.fixture(scope="function", autouse=True)
# def app_light_theme(app: Page):
#     yield app


# @pytest.fixture(scope="function", autouse=True)
# def app_dark_theme(page: Page, port: int):
#     page.goto(f"http://localhost:{port}/?embed_options=dark_theme")
#     wait_for_script_finish(page)
#     yield page


def test_dataframe_column_types(
    themed_app: Page, app_theme: str, assert_snapshot, browser_type: BrowserType
):
    # with open(f"dataframe-column-types.png", "wb") as f:
    #     f.write(page.screenshot())
    assert_snapshot(themed_app.screenshot())
    print("browser_type", browser_type.name)

    # Create locators for all elements with stDataFrame class
    st_dataframe_elements = themed_app.query_selector_all(".stDataFrame")

    # Expect the number of stDataFrame elements "to be strictly equal" to 8.
    # assert(len(st_dataframe_elements).to_be(8))
    # st_dataframe_elements.
    # assert len(st_dataframe_elements) == 8
    # expect(st_dataframe_elements).to_have_length(8)
    for i, element in enumerate(st_dataframe_elements):
        assert_snapshot(
            element.screenshot(),
            name=f"dataframe-column-types-{i}[{browser_type.name}][os][{app_theme}].png",
        )

        # Expect the screenshot "to be" the same as the previously stored screenshot.
        # This would require a separate image comparison library
        # As Playwright for Python does not natively support screenshot comparison.
        # You would have to implement your own function for comparing screenshots here.

        # Saving the screenshot for now
        # with open(f"dataframe-column-types-{i}.png", "wb") as f:
        #     f.write(screenshot)
