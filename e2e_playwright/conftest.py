# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import hashlib
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from random import randint
from tempfile import TemporaryFile
from typing import TYPE_CHECKING, Any, Callable, Generator, Literal, Protocol
from urllib import parse

import pytest
import requests
from PIL import Image
from playwright.sync_api import (
    ElementHandle,
    FrameLocator,
    Locator,
    Page,
    Response,
    Route,
)
from pytest import FixtureRequest

if TYPE_CHECKING:
    from types import ModuleType


def reorder_early_fixtures(metafunc: pytest.Metafunc):
    """Put fixtures with `pytest.mark.early` first during execution

    This allows patch of configurations before the application is initialized

    Copied from: https://github.com/pytest-dev/pytest/issues/1216#issuecomment-456109892
    """
    for fixturedef in metafunc._arg2fixturedefs.values():
        fixturedef = fixturedef[0]
        for mark in getattr(fixturedef.func, "pytestmark", []):
            if mark.name == "early":
                order = metafunc.fixturenames
                order.insert(0, order.pop(order.index(fixturedef.argname)))
                break


def pytest_generate_tests(metafunc: pytest.Metafunc):
    reorder_early_fixtures(metafunc)


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


def hash_to_range(
    text: str,
    min: int = 10000,
    max: int = 65535,
) -> int:
    sha256_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return min + (int(sha256_hash, 16) % (max - min + 1))


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


@pytest.fixture(scope="module")
def app_port(worker_id: str) -> int:
    """Fixture that returns an available port on localhost."""
    if worker_id and worker_id != "master":
        # This is run with xdist, we try to get a port by hashing the worker ID
        port = hash_to_range(worker_id)
        if is_port_available(port, "localhost"):
            return port
    # Find a random available port:
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
            "--global.e2eTest",
            "true",
            "--server.port",
            str(app_port),
            "--browser.gatherUsageStats",
            "false",
            "--server.fileWatcherType",
            "none",
            "--server.enableStaticServing",
            "true",
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


@pytest.fixture(scope="function")
def app_with_query_params(
    page: Page, app_port: int, request: FixtureRequest
) -> tuple[Page, dict]:
    """Fixture that opens the app with additional query parameters.
    The query parameters are passed as a dictionary in the 'param' key of the request.
    """
    query_params = request.param
    query_string = parse.urlencode(query_params, doseq=True)
    url = f"http://localhost:{app_port}/?{query_string}"
    page.goto(url)
    wait_for_app_loaded(page)

    return page, query_params


@dataclass
class IframedPageAttrs:
    # id attribute added to the iframe html tag
    element_id: str | None = None
    # query params to be appended to the iframe src URL
    src_query_params: dict[str, str] | None = None
    # additional HTML body
    additional_html_head: str | None = None
    # html content to load. Following placeholders are replaced during the test:
    # - $APP_URL: the URL of the Streamlit app
    html_content: str | None = None


@dataclass
class IframedPage:
    # the page to configure
    page: Page
    # opens the configured page via the iframe URL and returns the frame_locator
    # pointing to the iframe
    open_app: Callable[[IframedPageAttrs | None], FrameLocator]


@pytest.fixture(scope="function")
def iframed_app(page: Page, app_port: int) -> IframedPage:
    """Fixture that returns an IframedPage.

    The page object can be used to configure additional routes, for example to override
    the host-config. The open_app function triggers the opening of the app in an iframe.
    """
    # we are going to intercept the request, so the address and html-file is arbitrarily
    # chosen and does not even exist
    fake_iframe_server_origin = "http://localhost:1345"
    fake_iframe_server_route = f"{fake_iframe_server_origin}/iframed_app.html"
    # the url where the Streamlit server is reachable
    app_url = f"http://localhost:{app_port}"
    # the CSP header returned for the Streamlit index.html loaded in the iframe. This is
    # similar to a common CSP we have seen in the wild.
    app_csp_header = (
        f"default-src 'none'; worker-src blob:; form-action 'none'; "
        f"connect-src ws://localhost:{app_port}/_stcore/stream "
        f"http://localhost:{app_port}/_stcore/allowed-message-origins "
        f"http://localhost:{app_port}/_stcore/host-config "
        f"http://localhost:{app_port}/_stcore/health; script-src 'unsafe-inline' "
        f"'unsafe-eval' {app_url}/static/js/; style-src 'unsafe-inline' "
        f"{app_url}/static/css/; img-src data: {app_url}/favicon.png "
        f"{app_url}/favicon.ico; font-src {app_url}/static/fonts/ "
        f"{app_url}/static/media/; frame-ancestors {fake_iframe_server_origin};"
    )

    def _open_app(iframe_element_attrs: IframedPageAttrs | None = None) -> FrameLocator:
        _iframe_element_attrs = iframe_element_attrs
        if _iframe_element_attrs is None:
            _iframe_element_attrs = IframedPageAttrs()

        query_params = ""
        if _iframe_element_attrs.src_query_params:
            query_params = "?" + parse.urlencode(_iframe_element_attrs.src_query_params)

        src = f"{app_url}/{query_params}"
        additional_html_head = (
            _iframe_element_attrs.additional_html_head
            if _iframe_element_attrs.additional_html_head
            else ""
        )
        _iframed_body = (
            f"""
            <!DOCTYPE html>
            <html style="height: 100%;">
                <head>
                    <meta charset="UTF-8">
                    <title>Iframed Streamlit App</title>
                    {additional_html_head}
                </head>
                <body style="height: 100%;">
                    <iframe
                        src={src}
                        id={_iframe_element_attrs.element_id
                            if _iframe_element_attrs.element_id
                            else ""}
                        title="Iframed Streamlit App"
                        allow="clipboard-write; microphone;"
                        sandbox="allow-popups allow-same-origin allow-scripts allow-downloads"
                        width="100%"
                    >
                    </iframe>
                </body>
            </html>
            """
            if _iframe_element_attrs.html_content is None
            else _iframe_element_attrs.html_content.replace("$APP_URL", app_url)
        )

        def fulfill_iframe_request(route: Route) -> None:
            """Return as response an iframe that loads the actual Streamlit app."""

            browser = page.context.browser
            # webkit requires the iframe's parent to have "blob:" set, for example if we
            # want to download a CSV via the blob: url; Chrome seems to be more lax
            frame_src_blob = ""
            if browser is not None and (
                browser.browser_type.name == "webkit"
                or browser.browser_type.name == "firefox"
            ):
                frame_src_blob = "blob:"

            route.fulfill(
                status=200,
                body=_iframed_body,
                headers={
                    "Content-Type": "text/html",
                    "Content-Security-Policy": f"frame-src {frame_src_blob} {app_url};",
                },
            )

        # intercept all requests to the fake iframe server and fullfil the request in
        # playwright
        page.route(fake_iframe_server_route, fulfill_iframe_request)

        def fullfill_streamlit_app_request(route: Route) -> None:
            """Get the actual Streamlit app and return it's content."""
            response = route.fetch()
            route.fulfill(
                body=response.body(),
                headers={**response.headers, "Content-Security-Policy": app_csp_header},
            )

        # this will route the request to the actual Streamlit app
        page.route(src, fullfill_streamlit_app_request)

        def _expect_streamlit_app_loaded_in_iframe_with_added_header(
            response: Response,
        ) -> bool:
            """Ensure that the routing-interception worked and that Streamlit app is
            indeed loaded with the CSP header we expect"""

            return (
                response.url == src
                and response.headers["content-security-policy"] == app_csp_header
            )

        with page.expect_event(
            "response",
            predicate=_expect_streamlit_app_loaded_in_iframe_with_added_header,
        ):
            page.goto(fake_iframe_server_route, wait_until="domcontentloaded")
            frame_locator = page.frame_locator("iframe")
            frame_locator.nth(0).get_by_test_id("stAppViewContainer").wait_for(
                timeout=30000, state="attached"
            )
        return frame_locator

    return IframedPage(page, _open_app)


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args: dict, browser_name: str):
    """Fixture that adds the fake device and ui args to the browser type launch args."""
    # The browser context fixture in pytest-playwright is defined in session scope, and
    # depends on the browser_type_launch_args fixture. This means that we can't
    # redefine the browser_type_launch_args fixture more narrow scope
    # e.g. function or module scope.
    # https://github.com/microsoft/playwright-pytest/blob/ef99541352b307411dbc15c627e50f95de30cc71/pytest_playwright/pytest_playwright.py#L128

    # We need to extend browser launch args to support fake video stream for
    # st.camera_input test.
    # https://github.com/microsoft/playwright/issues/4532#issuecomment-1491761713

    if browser_name == "chromium":
        browser_type_launch_args = {
            **browser_type_launch_args,
            "args": [
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
            ],
        }

    elif browser_name == "firefox":
        browser_type_launch_args = {
            **browser_type_launch_args,
            "firefox_user_prefs": {
                "media.navigator.streams.fake": True,
                "media.navigator.permission.disabled": True,
                "permissions.default.microphone": 1,
                "permissions.default.camera": 1,
            },
        }
    return browser_type_launch_args


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
    """Fixture returning the directory that is used for all test failures information.

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

    test_failure_messages: list[str] = []

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
            test_failure_messages.append(
                f"Snapshot matching for {snapshot_file_name} failed. "
                f"Expected size: {img_b.size}, actual size: {img_a.size}. "
                f"Error: {ex}"
            )
            return
        total_pixels = img_a.size[0] * img_a.size[1]
        max_diff_pixels = int(image_threshold * total_pixels)

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

        test_failure_messages.append(
            f"Snapshot mismatch for {snapshot_file_name} ({mismatch} pixels difference;"
            f" {mismatch/total_pixels * 100:.2f}%)"
        )

    yield compare

    if test_failure_messages:
        pytest.fail(
            "Missing or mismatched snapshots: \n" + "\n".join(test_failure_messages)
        )


# Public utility methods:


def wait_for_app_run(
    page_or_locator: Page | Locator | FrameLocator, wait_delay: int = 100
):
    """Wait for the given page to finish running."""
    # Add a little timeout to wait for eventual debounce timeouts used in some widgets.

    page = None
    if isinstance(page_or_locator, Page):
        page = page_or_locator
    elif isinstance(page_or_locator, Locator):
        page = page_or_locator.page
    elif isinstance(page_or_locator, FrameLocator):
        page = page_or_locator.owner.page

    # if isinstance(page, Page):
    page.wait_for_timeout(155)
    # Make sure that the websocket connection is established.
    page_or_locator.locator(
        "[data-testid='stApp'][data-test-connection-state='CONNECTED']"
    ).wait_for(
        timeout=20000,
        state="attached",
    )
    # Wait until we know the script has started. We determine this by checking
    # whether the app is in notRunning state. (The data-test-connection-state attribute
    # goes through the sequence "initial" -> "running" -> "notRunning").
    page_or_locator.locator(
        "[data-testid='stApp'][data-test-script-state='notRunning']"
    ).wait_for(
        timeout=20000,
        state="attached",
    )

    if wait_delay > 0:
        # Give the app a little more time to render everything
        page.wait_for_timeout(wait_delay)


def wait_for_app_loaded(page: Page, embedded: bool = False):
    """Wait for the app to fully load."""
    # Wait for the app view container to appear:
    page.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )

    # Wait for the main menu to appear:
    if not embedded:
        page.wait_for_selector(
            "[data-testid='stMainMenu']", timeout=20000, state="attached"
        )

    wait_for_app_run(page)


def rerun_app(page: Page):
    """Triggers an app rerun and waits for the run to be finished."""
    # Click somewhere to clear the focus from elements:
    page.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    # Press "r" to rerun the app:
    page.keyboard.press("r")
    wait_for_app_run(page)


def wait_until(page: Page, fn: Callable, timeout: int = 5000, interval: int = 100):
    """Run a test function in a loop until it evaluates to True
    or times out.

    For example:
    >>> wait_until(lambda: x.values() == ["x"], page)

    Parameters
    ----------
    page : playwright.sync_api.Page
        Playwright page
    fn : Callable
        Callback
    timeout : int, optional
        Total timeout in milliseconds, by default 5000
    interval : int, optional
        Waiting interval, by default 100

    Adapted from panel.
    """
    # Hide this function traceback from the pytest output if the test fails
    __tracebackhide__ = True

    start = time.time()

    def timed_out():
        elapsed = time.time() - start
        elapsed_ms = elapsed * 1000
        return elapsed_ms > timeout

    timeout_msg = f"wait_until timed out in {timeout} milliseconds"

    while True:
        try:
            result = fn()
        except AssertionError as e:
            if timed_out():
                raise TimeoutError(timeout_msg) from e
        else:
            if result not in (None, True, False):
                raise ValueError(
                    "`wait_until` callback must return None, True or "
                    f"False, returned {result!r}"
                )
            # Stop is result is True or None
            # None is returned when the function has an assert
            if result is None or result:
                return
            if timed_out():
                raise TimeoutError(timeout_msg)
        page.wait_for_timeout(interval)
