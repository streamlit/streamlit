# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from io import BytesIO, TextIOWrapper
from pathlib import Path
from random import randint
from tempfile import TemporaryFile
from typing import TYPE_CHECKING, Any, Final, Literal, Protocol
from urllib import parse

import pytest
import requests
from PIL import Image
from playwright.sync_api import (
    Browser,
    BrowserContext,
    BrowserType,
    ElementHandle,
    FrameLocator,
    Locator,
    Page,
    Response,
    Route,
    expect,
)
from typing_extensions import Self

from e2e_playwright.shared.app_target import (
    AppTarget,
    wait_for_app_target_loaded,
)
from e2e_playwright.shared.git_utils import get_git_root
from e2e_playwright.shared.performance import (
    is_supported_browser,
    measure_performance,
    start_capture_traces,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Generator
    from types import ModuleType, TracebackType

# Register pytest plugins
pytest_plugins = ["e2e_playwright.shared.stats_reporter"]


# Used for static app testing
class StaticPage(Page):
    pass


def pytest_addoption(parser: pytest.Parser) -> None:
    """Register custom command-line options."""
    parser.addoption(
        "--external-app-url",
        action="store",
        default=None,
        help="Run tests against an externally hosted app URL instead of localhost",
    )
    parser.addoption(
        "--external-host-url",
        action="store",
        default=None,
        help=(
            "Optional host page URL for externally hosted apps. "
            "If provided, tests can load the host page (e.g. Snowsight) and target the app iframe."
        ),
    )
    parser.addoption(
        "--external-iframe-selector",
        action="store",
        default=None,
        help=(
            "CSS selector for the iframe element that contains the app when using --external-host-url. "
            "Defaults to 'iframe'."
        ),
    )
    parser.addoption(
        "--browser-state-path",
        action="store",
        default=None,
        help=(
            "Path to a Playwright storage state JSON file "
            "(for example, to preload an authenticated browser session)."
        ),
    )


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "no_perf: mark test to not use performance profiling"
    )
    config.addinivalue_line(
        "markers", "app_hash(hash): mark test to open the app with a URL hash"
    )
    config.addinivalue_line(
        "markers",
        "external_test(upload_test_assets=False): "
        "mark test as compatible with external app execution mode. "
        "Set upload_test_assets=True when the hosted app needs "
        "`e2e_playwright/static/` to be available. "
        "Only the documented keyword arguments are supported (unknown kwargs error).",
    )


def reorder_early_fixtures(metafunc: pytest.Metafunc) -> None:
    """Put fixtures with `pytest.mark.early` first during execution.

    This allows patch of configurations before the application is initialized

    Copied from: https://github.com/pytest-dev/pytest/issues/1216#issuecomment-456109892
    """
    for fixture_definitions in metafunc._arg2fixturedefs.values():
        fixturedef = fixture_definitions[0]
        for mark in getattr(fixturedef.func, "pytestmark", []):
            if mark.name == "early":
                order = metafunc.fixturenames
                order.insert(0, order.pop(order.index(fixturedef.argname)))
                break


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    reorder_early_fixtures(metafunc)


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Validate external app mode configuration during collection.

    When external app / host mode is enabled, we expect at least one collected
    test to be marked with ``@pytest.mark.external_test``. Without that marker,
    all tests will be skipped (see ``skip_non_external_tests_in_external_mode``)
    which is usually not what the user intended.
    """
    for item in items:
        marker = item.get_closest_marker("external_test")
        if marker is None:
            continue

        if marker.args:
            raise pytest.UsageError(
                "external_test marker does not accept positional arguments. "
                "Use keyword arguments only, e.g. "
                "@pytest.mark.external_test(upload_test_assets=True)."
            )

        allowed_kwargs = {"upload_test_assets"}
        unknown_kwargs = sorted(set(marker.kwargs) - allowed_kwargs)
        if unknown_kwargs:
            raise pytest.UsageError(
                "external_test marker received unknown keyword arguments: "
                f"{', '.join(unknown_kwargs)}. "
                "Allowed keyword arguments: upload_test_assets."
            )

        if "upload_test_assets" in marker.kwargs and not isinstance(
            marker.kwargs["upload_test_assets"], bool
        ):
            raise pytest.UsageError(
                "external_test marker keyword argument upload_test_assets "
                "must be a boolean."
            )

    external_app = _get_config_option_or_env(
        config, "--external-app-url", "STREAMLIT_E2E_EXTERNAL_APP_URL"
    )
    external_host = _get_config_option_or_env(
        config, "--external-host-url", "STREAMLIT_E2E_EXTERNAL_HOST_URL"
    )
    if not (external_app or external_host):
        return

    if any(item.get_closest_marker("external_test") is not None for item in items):
        return

    raise pytest.UsageError(
        "External app mode was enabled, but no collected tests were marked "
        "with @pytest.mark.external_test. Mark at least one compatible test "
        "with 'external_test', or run without --external-app-url/--external-host-url "
        "(and the corresponding STREAMLIT_E2E_EXTERNAL_* env vars)."
    )


def _get_config_option_or_env(
    pytestconfig: pytest.Config, option_name: str, env_name: str
) -> str | None:
    # `pytestconfig.getoption` is typed as `Any` in pytest, but for our `store`
    # options (e.g. `--external-app-url`) we expect `str | None`.
    raw_value = pytestconfig.getoption(option_name)
    if raw_value is not None:
        if not isinstance(raw_value, str):
            raise pytest.UsageError(
                f"Expected {option_name} to be a string, got {type(raw_value).__name__}."
            )
        value = raw_value.strip()
        if value:
            return value

    env_raw_value = os.getenv(env_name)
    if env_raw_value is not None:
        env_value = env_raw_value.strip()
        if env_value:
            return env_value

    return None


def _build_app_url(base_url: str, *, fragment: str | None) -> str:
    """Build an app navigation URL from ``base_url`` and an optional fragment.

    This preserves the user-provided path (including any trailing slash) to
    avoid altering routing semantics for externally hosted apps.

    The only normalization we do is mapping an empty path to ``"/"`` so that
    ``https://example.com#foo`` and ``https://example.com/#foo`` both navigate
    to the root path with the given fragment.
    """
    split = parse.urlsplit(base_url)
    path = _normalize_empty_path(split.path)

    if fragment is not None:
        frag = fragment.lstrip("#")
        return parse.urlunsplit((split.scheme, split.netloc, path, split.query, frag))

    return parse.urlunsplit((split.scheme, split.netloc, path, split.query, ""))


def _normalize_empty_path(path: str) -> str:
    """Normalize an empty URL path to ``"/"``.

    This intentionally does not change ``"/"`` or any non-empty path, including
    trailing slashes, to preserve user-provided routing semantics.
    """
    return "/" if path == "" else path


def _with_query_params(url: str, params: dict[str, str]) -> str:
    """Return ``url`` with the provided query params set.

    This preserves the original path (including any trailing slash) and only
    normalizes the empty-path case to ``"/"``.
    """
    split = parse.urlsplit(url)
    path = _normalize_empty_path(split.path)
    existing = dict(parse.parse_qsl(split.query, keep_blank_values=True))
    existing.update(params)
    query = parse.urlencode(existing, doseq=True)
    return parse.urlunsplit((split.scheme, split.netloc, path, query, split.fragment))


class AsyncSubprocess:
    """A context manager. Wraps subprocess. Popen to capture output safely."""

    args: list[str]
    cwd: str
    env: dict[str, str]
    _proc: subprocess.Popen[str] | None
    _stdout_file: TextIOWrapper | None

    def __init__(self, args: list[str], cwd: str, env: dict[str, str] | None = None):
        self.args = args
        self.cwd = cwd
        self.env = env or {}
        self._proc = None
        self._stdout_file = None

    def _stop_process(self) -> None:
        """Stop the subprocess with timeout handling.

        Attempts graceful termination first, then force kills if needed.
        Handles race conditions where process may exit between operations.
        """
        if self._proc is None:
            return

        self._proc.terminate()
        try:
            # Wait up to 20 seconds for graceful termination
            self._proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            # Force kill if it doesn't terminate gracefully
            print("Process did not terminate gracefully, force killing...", flush=True)
            try:
                self._proc.kill()
            except ProcessLookupError:
                pass  # Process already exited between timeout and kill
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass  # Give up, but don't hang
        self._proc = None

    def terminate(self) -> str | None:
        """Terminate the process and return its stdout/stderr in a string."""
        self._stop_process()

        # Read the stdout file and close it
        stdout = None
        if self._stdout_file is not None:
            self._stdout_file.seek(0)
            stdout = self._stdout_file.read()
            self._stdout_file.close()
            self._stdout_file = None

        return stdout

    def __enter__(self) -> Self:
        self.start()
        return self

    def start(self) -> None:
        # Start the process and capture its stdout/stderr output to a temp
        # file. We do this instead of using subprocess.PIPE (which causes the
        # Popen object to capture the output to its own internal buffer),
        # because large amounts of output can cause it to deadlock.
        self._stdout_file = TemporaryFile("w+", encoding="utf-8")
        print(f"Running: {shlex.join(self.args)}")
        self._proc = subprocess.Popen(
            self.args,
            cwd=self.cwd,
            stdout=self._stdout_file,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ.copy(), **self.env},
        )

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        self._stop_process()
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


# region Fixtures


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


@pytest.fixture(scope="session")
def external_app_url(pytestconfig: pytest.Config) -> str | None:
    """Return the external app URL if configured, otherwise None.

    The URL can be configured via CLI option or environment variable.
    """
    value = _get_config_option_or_env(
        pytestconfig, "--external-app-url", "STREAMLIT_E2E_EXTERNAL_APP_URL"
    )
    if value is None:
        return None

    parsed = parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise pytest.UsageError(
            "Invalid value for --external-app-url / STREAMLIT_E2E_EXTERNAL_APP_URL: "
            f"{value!r}. Expected an absolute HTTP(S) URL, e.g. "
            "'http://localhost:8501' or 'https://example.com/app'."
        )

    return value


@pytest.fixture(scope="session")
def external_host_url(
    pytestconfig: pytest.Config, external_app_url: str | None
) -> str | None:
    """Return the external host page URL if configured via CLI or environment.

    When configured, this must be an absolute HTTP(S) URL. It also requires that
    ``external_app_url`` is configured, since the app server will not be started
    locally in that mode.
    """
    value = _get_config_option_or_env(
        pytestconfig, "--external-host-url", "STREAMLIT_E2E_EXTERNAL_HOST_URL"
    )
    if value is None:
        return None

    if external_app_url is None:
        raise pytest.UsageError(
            "Invalid configuration: --external-host-url / "
            "STREAMLIT_E2E_EXTERNAL_HOST_URL was set without also setting "
            "--external-app-url / STREAMLIT_E2E_EXTERNAL_APP_URL. Please "
            "configure both options, or remove the external host URL."
        )

    parsed = parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise pytest.UsageError(
            "Invalid value for --external-host-url / STREAMLIT_E2E_EXTERNAL_HOST_URL: "
            f"{value!r}. Expected an absolute HTTP(S) URL, e.g. "
            "'http://localhost:3000/host-page' or 'https://example.com/host'."
        )

    return value


@pytest.fixture(scope="session")
def external_iframe_selector(pytestconfig: pytest.Config) -> str:
    """Return the iframe selector to use when targeting an externally hosted app inside a host page."""
    return (
        _get_config_option_or_env(
            pytestconfig,
            "--external-iframe-selector",
            "STREAMLIT_E2E_EXTERNAL_IFRAME_SELECTOR",
        )
        or "iframe"
    )


@pytest.fixture(scope="session")
def browser_state_path(pytestconfig: pytest.Config) -> Path | None:
    """Return a Path to a valid Playwright storage state file, otherwise None.

    The path can be configured via CLI option or environment variable.
    Raises ``pytest.UsageError`` if the configured path does not exist.
    """
    value = _get_config_option_or_env(
        pytestconfig, "--browser-state-path", "STREAMLIT_E2E_BROWSER_STATE_PATH"
    )
    if not value:
        return None
    path = Path(value).expanduser()
    if not path.exists():
        raise pytest.UsageError(f"Playwright storage state file not found at: {path}")
    return path


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    """Fixture that returns extra arguments to pass to the Streamlit app server."""
    return []


@pytest.fixture(scope="module", autouse=True)
def app_server(
    app_port: int,
    app_server_extra_args: list[str],
    request: pytest.FixtureRequest,
    external_app_url: str | None,
    external_host_url: str | None,
) -> Generator[AsyncSubprocess | None, None, None]:
    """Fixture that starts and stops the Streamlit app server.

    When ``external_app_url`` or ``external_host_url`` is configured, yields
    ``None`` and skips server startup, assuming the app is already running
    externally (either directly or embedded in a host page).
    """
    if external_app_url or external_host_url:
        yield None
        return
    streamlit_proc = start_app_server(
        app_port,
        request.module,
        extra_args=app_server_extra_args,
    )
    yield streamlit_proc
    streamlit_stdout = streamlit_proc.terminate()
    print(streamlit_stdout, flush=True)


@pytest.fixture(autouse=True)
def skip_non_external_tests_in_external_mode(
    request: pytest.FixtureRequest,
    external_app_url: str | None,
    external_host_url: str | None,
) -> None:
    """Automatically skip tests that are not marked as external-compatible.

    When running in external app mode (for example, when ``--external-app-url``
    is provided and ``external_app_url`` is not ``None``), only tests marked
    with ``@pytest.mark.external_test`` are executed. All other tests are
    skipped, since they rely on a locally started Streamlit app server that is
    not used in external app mode.

    This also applies when running in external host mode (for example, when
    ``--external-host-url`` is provided and ``external_host_url`` is not
    ``None``), where the app is embedded within another host page.
    """
    if not (external_app_url or external_host_url):
        return
    if request.node.get_closest_marker("external_test") is None:
        pytest.skip("External app mode only supports tests marked 'external_test'.")


def _get_app_hash_fragment(request: pytest.FixtureRequest) -> str:
    """Return the fragment from `@pytest.mark.app_hash(...)`, or "" if unset."""
    marker = request.node.get_closest_marker("app_hash")
    if marker is None:
        return ""

    if len(marker.args) != 1:
        raise pytest.UsageError(
            "app_hash marker requires a single string argument, e.g. "
            "@pytest.mark.app_hash('my-fragment')"
        )

    marker_arg = marker.args[0]
    if not isinstance(marker_arg, str):
        raise pytest.UsageError(
            f"app_hash marker argument must be a string, got {type(marker_arg).__name__}."
        )

    return marker_arg


def _open_app(page: Page, app_base_url: str, *, hash_fragment: str) -> None:
    url = build_app_url(app_base_url, fragment=hash_fragment)
    response = page.goto(url)
    if response is None:
        raise RuntimeError(f"Unable to load {url!r}")
    if response.status == 404:
        raise RuntimeError(
            "App returned 404. Try building the frontend with `make frontend-fast`."
        )
    if not response.ok:
        raise RuntimeError(f"Unable to load {url!r}. Status: {response.status}")


@pytest.fixture
def app(
    page: Page,
    app_base_url: str,
    request: pytest.FixtureRequest,
) -> Page:
    """Fixture that opens the app."""
    hash_fragment = _get_app_hash_fragment(request)

    _open_app(page, app_base_url, hash_fragment=hash_fragment)
    start_capture_traces(page)
    wait_for_app_loaded(page)
    return page


@pytest.fixture
def app_target(
    page: Page,
    app_base_url: str,
    request: pytest.FixtureRequest,
    external_app_url: str | None,
    external_host_url: str | None,
    external_iframe_selector: str,
) -> AppTarget:
    """Return an AppTarget that abstracts where the app is hosted.

    Tests should use this fixture (instead of receiving a bare FrameLocator) for
    external-compatible scenarios. This keeps iframe-vs-top-level an internal
    implementation detail of our test infrastructure.
    """
    hash_fragment = _get_app_hash_fragment(request)

    if external_host_url:
        page.goto(external_host_url)
        start_capture_traces(page)
        page.wait_for_load_state()

        # External host mode embeds the app in an iframe. If a test requests a
        # specific fragment via `@pytest.mark.app_hash(...)`, propagate it to
        # the iframe's URL before we start interacting with the DOM.
        if hash_fragment:
            iframe = page.locator(external_iframe_selector).first
            iframe_src = iframe.get_attribute("src")
            iframe_base_url = iframe_src or external_app_url or app_base_url
            iframe_url = build_app_url(iframe_base_url, fragment=hash_fragment)
            if iframe_src != iframe_url:
                iframe.evaluate("(el, src) => { el.src = src; }", iframe_url)

        frame_locator = page.frame_locator(external_iframe_selector)
        target = AppTarget(
            page=page,
            dom=frame_locator,
            base_url=app_base_url,
            mode="external_host",
        )
        wait_for_app_target_loaded(target)
        return target

    _open_app(page, app_base_url, hash_fragment=hash_fragment)
    start_capture_traces(page)
    target = AppTarget(
        page=page,
        dom=page,
        base_url=app_base_url,
        mode="external_direct" if external_app_url else "local",
    )
    wait_for_app_target_loaded(target)
    return target


@pytest.fixture(scope="module")
def app_base_url(app_port: int, external_app_url: str | None) -> str:
    """Return the base URL to use for app navigation.

    Returns ``external_app_url`` if configured; otherwise constructs a localhost
    URL using ``app_port``.
    """
    return external_app_url or f"http://localhost:{app_port}"


def build_app_url(
    base_url: str,
    *,
    path: str = "",
    query: dict[str, Any] | str | None = None,
    fragment: str = "",
) -> str:
    """Build a URL relative to the provided base URL.

    Notes
    -----
    Passing ``path=""`` (the default) is treated the same as not providing a
    path at all.
    """
    split_url = parse.urlsplit(base_url)
    base_path = split_url.path or ""
    if path:
        # Always preserve any existing base path, even when `path` starts with "/".
        #
        # Examples:
        # - base_url="https://host/prefix", path="/_stcore/health"
        #   -> "/prefix/_stcore/health"
        # - base_url="https://host/prefix", path="//some-path"
        #   -> "/prefix//some-path"
        # - base_url="https://host", path="/_stcore/health"
        #   -> "/_stcore/health"
        if path.startswith("/"):
            full_path = f"{base_path.rstrip('/')}{path}" if base_path else path
        elif base_path:
            full_path = f"{base_path.rstrip('/')}/{path}"
        else:
            full_path = f"/{path}"
    # Preserve the base URL as-is when no additional parts are provided:
    #
    # - base_url="http://localhost:8501" -> "http://localhost:8501"
    #
    # But when adding a query string or fragment to a host-only base URL,
    # add a "/" so parameters attach to the root path:
    #
    # - base_url="http://localhost:8501", query="a=1" -> "http://localhost:8501/?a=1"
    # - base_url="http://localhost:8501", fragment="foo" -> "http://localhost:8501/#foo"
    elif base_path:
        full_path = base_path
    else:
        full_path = "/" if (query is not None or fragment) else ""

    base_query = parse.parse_qsl(split_url.query, keep_blank_values=True)
    if query is None:
        combined_query = base_query
    else:
        if isinstance(query, str):
            # Allow callers to pass either "a=1&b=2" or "?a=1&b=2".
            query_items = parse.parse_qsl(query.lstrip("?"), keep_blank_values=True)
        else:
            query_items = parse.parse_qsl(
                parse.urlencode(query, doseq=True), keep_blank_values=True
            )
        combined_query = base_query + query_items

    query_string = parse.urlencode(combined_query, doseq=True)
    # Allow callers to pass either "foo" or "#foo".
    final_fragment = fragment.lstrip("#") if fragment else split_url.fragment

    return parse.urlunsplit(
        (split_url.scheme, split_url.netloc, full_path, query_string, final_fragment)
    )


def _ensure_nonempty_path(url: str) -> str:
    """Ensure the URL has a non-empty path (at least '/')."""
    split_url = parse.urlsplit(url)
    if split_url.path:
        return url
    return parse.urlunsplit(
        (split_url.scheme, split_url.netloc, "/", split_url.query, split_url.fragment)
    )


def _normalize_url_for_compare(url: str) -> str:
    """Normalize a URL for reliable comparison across browsers."""
    split_url = parse.urlsplit(url)
    normalized_path = split_url.path.rstrip("/") or "/"
    return parse.urlunsplit(
        (split_url.scheme, split_url.netloc, normalized_path, split_url.query, "")
    )


@pytest.fixture
def static_app(
    page: Page,
    app_base_url: str,
    request: pytest.FixtureRequest,
) -> Page:
    """Fixture that opens the app."""
    query_param = request.node.get_closest_marker("query_param")
    query_string = query_param.args[0] if query_param else ""

    # Indicate this is a static app page.
    page.__class__ = StaticPage

    page.goto(build_app_url(app_base_url, path=query_string))
    start_capture_traces(page)
    wait_for_app_loaded(page)
    return page


@pytest.fixture
def app_with_query_params(
    page: Page, app_base_url: str, request: pytest.FixtureRequest
) -> tuple[Page, dict[str, Any]]:
    """Fixture that opens the app with additional query parameters.
    The query parameters are passed as a dictionary in the 'param' key of the request.
    """
    query_params = request.param
    query_string = parse.urlencode(query_params, doseq=True)
    page.goto(build_app_url(app_base_url, query=query_string))
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


@pytest.fixture
def iframed_app(page: Page, app_base_url: str) -> IframedPage:
    """Fixture that returns an IframedPage.

    The page object can be used to configure additional routes, for example to override
    the host-config. The open_app function triggers the opening of the app in an iframe.
    """
    # we are going to intercept the request, so the address and html-file is arbitrarily
    # chosen and does not even exist
    fake_iframe_server_origin = "http://localhost:1345"
    fake_iframe_server_route = f"{fake_iframe_server_origin}/iframed_app.html"
    # The URL where the Streamlit server is reachable (used to build CSP endpoints).
    # This must not include query params or fragments, since we later append paths.
    split_base_url = parse.urlsplit(app_base_url)

    normalized_path = (split_base_url.path or "").rstrip("/")
    app_url_for_endpoints = parse.urlunsplit(
        (split_base_url.scheme, split_base_url.netloc, normalized_path, "", "")
    )
    app_url_for_iframe = _ensure_nonempty_path(app_url_for_endpoints)

    # Compute the websocket stream URL from the configured app base URL.
    # This is required because the iframe page applies a strict CSP that must allow the
    # app's websocket endpoint, otherwise the app will never reach CONNECTED.
    split_app_url = parse.urlsplit(app_url_for_endpoints)
    ws_scheme = "wss" if split_app_url.scheme == "https" else "ws"
    base_path = (split_app_url.path or "").rstrip("/")
    ws_stream_path = f"{base_path}/_stcore/stream" if base_path else "/_stcore/stream"
    ws_stream_url = parse.urlunsplit(
        (ws_scheme, split_app_url.netloc, ws_stream_path, "", "")
    )

    # the CSP header returned for the Streamlit index.html loaded in the iframe. This is
    # similar to a common CSP we have seen in the wild.
    app_csp_header = f"""
default-src 'none';
worker-src blob:;
form-action 'none';
frame-ancestors {fake_iframe_server_origin};
frame-src data: {app_url_for_endpoints}/_stcore/component/ {app_url_for_endpoints}/component/;
img-src 'self' https: data: blob:;
media-src 'self' https: data: blob:;
connect-src {ws_stream_url}
    {app_url_for_endpoints}/_stcore/component/
    {app_url_for_endpoints}/_stcore/bidi-components/
    {app_url_for_endpoints}/component/
    {app_url_for_endpoints}/_stcore/upload_file/
    {app_url_for_endpoints}/_stcore/host-config
    {app_url_for_endpoints}/_stcore/health
    {app_url_for_endpoints}/_stcore/message
    {app_url_for_endpoints}/media/
    https://some-prefix.com/somethingelse/_stcore/upload_file/
    https://events.mapbox.com/
    https://api.mapbox.com/v4/
    https://api.mapbox.com/raster/v1/
    https://api.mapbox.com/rasterarrays/v1/
    https://api.mapbox.com/styles/v1/mapbox/
    https://api.mapbox.com/fonts/v1/mapbox/
    https://api.mapbox.com/models/v1/mapbox/
    https://api.mapbox.com/map-sessions/v1
    https://data.streamlit.io/tokens.json
    https://basemaps.cartocdn.com
    https://tiles.basemaps.cartocdn.com
    https://tiles-a.basemaps.cartocdn.com
    https://tiles-b.basemaps.cartocdn.com
    https://tiles-c.basemaps.cartocdn.com
    https://tiles-d.basemaps.cartocdn.com
    data: blob:;
style-src 'unsafe-inline'
    https://api.mapbox.com/mapbox-gl-js/
    {app_url_for_endpoints}/static/css/
    blob:;
script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:
    https://api.mapbox.com/mapbox-gl-js/
    {app_url_for_endpoints}/static/js/;
font-src {app_url_for_endpoints}/static/fonts/ {app_url_for_endpoints}/static/media/ https: data: blob:;
""".replace("\n", " ").strip()

    def _open_app(iframe_element_attrs: IframedPageAttrs | None = None) -> FrameLocator:
        _iframe_element_attrs = iframe_element_attrs
        if _iframe_element_attrs is None:
            _iframe_element_attrs = IframedPageAttrs()

        src = build_app_url(
            app_url_for_iframe, query=_iframe_element_attrs.src_query_params
        )
        if not parse.urlsplit(src).path:
            raise RuntimeError(f"Iframe src must include a path: {src!r}")
        additional_html_head = _iframe_element_attrs.additional_html_head or ""
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
                        src="{src}"
                        id="{_iframe_element_attrs.element_id or ""}"
                        title="Iframed Streamlit App"
                        allow="clipboard-read; clipboard-write; microphone; camera;"
                        sandbox="allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
                        width="100%"
                    >
                    </iframe>
                </body>
            </html>
            """
            if _iframe_element_attrs.html_content is None
            else _iframe_element_attrs.html_content.replace(
                "$APP_URL", app_url_for_iframe
            )
        )

        def fulfill_iframe_request(route: Route) -> None:
            """Return as response an iframe that loads the actual Streamlit app."""
            browser = page.context.browser
            # webkit requires the iframe's parent to have "blob:" set, for example if we
            # want to download a CSV via the blob: url; Chrome seems to be more lax
            frame_src_blob = ""
            if browser is not None and (
                browser.browser_type.name in {"webkit", "firefox"}
            ):
                frame_src_blob = "blob:"

            route.fulfill(
                status=200,
                body=_iframed_body,
                headers={
                    "Content-Type": "text/html",
                    "Content-Security-Policy": f"frame-src {frame_src_blob} {app_url_for_iframe};",
                },
            )

        # intercept all requests to the fake iframe server and fulfill the request in
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
            indeed loaded with the CSP header we expect.
            """

            return (
                _normalize_url_for_compare(response.url)
                == _normalize_url_for_compare(src)
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
def browser_type_launch_args(
    browser_type_launch_args: dict[str, Any], browser_name: str
) -> dict[str, Any]:
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
                # Disable Private Network Access / Local Network Access checks that block
                # WebSocket connections from iframe content to localhost in Chromium 148+.
                # This is needed because the iframe tests load content from a fake server
                # (localhost:1345) which then tries to connect via WebSocket to the
                # Streamlit server on a different localhost port.
                # https://developer.chrome.com/blog/private-network-access-update
                "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights",
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
                # Reduces screenshot flakiness caused by subpixel rendering and
                # font rendering:
                "layout.css.devPixelsPerPx": "1.0",
                "browser.display.use_system_colors": False,
                "gfx.font_rendering.cleartype_params.rendering_mode": 5,
                # Stability preferences to prevent unexpected browser closures
                # (see Playwright 1.58+ Firefox 146 issues):
                "toolkit.startup.max_resumed_crashes": -1,  # Disable crash recovery
                "browser.sessionstore.resume_from_crash": False,
                "browser.shell.checkDefaultBrowser": False,
                "browser.tabs.crashReporting.sendReport": False,
                "dom.ipc.reportProcessHangs": False,
                # Disable features that can cause instability in automation:
                "browser.safebrowsing.enabled": False,
                "browser.safebrowsing.malware.enabled": False,
                "datareporting.policy.dataSubmissionEnabled": False,
                "toolkit.telemetry.enabled": False,
            },
        }
    return browser_type_launch_args


@pytest.fixture(scope="session")
def browser_context_args(
    browser_context_args: dict[str, Any],
    browser_name: str,
    browser_state_path: Path | None,
) -> dict[str, Any]:
    """Fixture that configures browser context.

    Sets ``storage_state`` if ``browser_state_path`` is provided, and adds
    clipboard permissions for Chromium browsers.
    """
    if browser_state_path is not None:
        browser_context_args = {
            **browser_context_args,
            "storage_state": str(browser_state_path),
        }
    # Clipboard permissions are only supported in Chromium-based browsers
    if browser_name == "chromium":
        return {
            **browser_context_args,
            "permissions": ["clipboard-read", "clipboard-write"],
        }

    return browser_context_args


class ResilientBrowser:
    """Wrapper around Browser that can recover from unexpected browser closures.

    This is a workaround for Firefox stability issues in Playwright 1.58+ (Firefox 146).
    When the browser closes unexpectedly, subsequent tests fail with TargetClosedError.
    This wrapper detects the closure and relaunches the browser automatically.
    """

    def __init__(
        self,
        browser_type: BrowserType,
        launch_args: dict[str, Any],
    ):
        self._browser_type = browser_type
        self._launch_args = launch_args
        self._browser: Browser | None = None
        # Launch browser eagerly to match pytest-playwright behavior
        self._ensure_connected()

    def _launch(self) -> Browser:
        """Launch a new browser instance."""
        return self._browser_type.launch(**self._launch_args)

    def _ensure_connected(self) -> Browser:
        """Ensure browser is connected, relaunching if necessary."""
        if self._browser is None or not self._browser.is_connected():
            if self._browser is not None:
                print(
                    "Firefox browser disconnected unexpectedly. Relaunching...",
                    flush=True,
                )
            self._browser = self._launch()
        return self._browser

    def new_context(self, **kwargs: Any) -> BrowserContext:
        """Create a new browser context, relaunching browser if needed."""
        browser = self._ensure_connected()
        return browser.new_context(**kwargs)

    def close(self) -> None:
        """Close the browser."""
        if self._browser is not None and self._browser.is_connected():
            try:
                self._browser.close()
            except Exception as exc:
                # Browser may disconnect between is_connected() and close().
                # Log the error but continue cleanup.
                print(
                    f"Error while closing browser in ResilientBrowser.close: {exc}",
                    flush=True,
                )
        self._browser = None

    @property
    def contexts(self) -> list[BrowserContext]:
        """Return list of browser contexts."""
        if self._browser is None or not self._browser.is_connected():
            return []
        try:
            return self._browser.contexts
        except Exception:
            # The browser may disconnect between the connectivity check and accessing
            # the contexts attribute. In that case, behave as if there are no contexts.
            return []

    @property
    def browser_type(self) -> BrowserType:
        """Return the browser type."""
        return self._browser_type

    def is_connected(self) -> bool:
        """Check if browser is connected."""
        return self._browser is not None and self._browser.is_connected()


@pytest.fixture(scope="session")
def browser(
    browser_type: BrowserType,
    browser_type_launch_args: dict[str, Any],
    browser_name: str,
    launch_browser: Callable[[], Browser],
) -> Generator[Browser | ResilientBrowser, None, None]:
    """Override pytest-playwright's browser fixture to handle Firefox crashes.

    For Firefox, we use a ResilientBrowser wrapper that can recover from unexpected
    browser closures. For other browsers, we use the standard launch_browser callable.
    """
    if browser_name == "firefox":
        resilient = ResilientBrowser(browser_type, browser_type_launch_args)
        yield resilient
        resilient.close()
    else:
        browser = launch_browser()
        yield browser
        browser.close()


@pytest.fixture(params=["light_theme", "dark_theme"])
def app_theme(request: pytest.FixtureRequest) -> str:
    """Fixture that returns the theme name."""
    return str(request.param)


@pytest.fixture
def themed_app(page: Page, app_base_url: str, app_theme: str) -> Page:
    """Fixture that opens the app with the given theme."""
    page.goto(build_app_url(app_base_url, query={"embed_options": app_theme}))
    start_capture_traces(page)
    wait_for_app_loaded(page)
    return page


@pytest.fixture
def app_with_microphone_permission_denied(page: Page, app_base_url: str) -> Page:
    """Fixture that opens the app with getUserMedia mocked to deny microphone permissions.

    This fixture is used for testing microphone permission denied error handling in audio
    components. It injects a script that overrides navigator.mediaDevices.getUserMedia
    to always reject with a NotAllowedError before the app loads.
    """
    # Add init script BEFORE navigating to the page
    page.add_init_script("""
        // Override getUserMedia to always reject with NotAllowedError
        // Must use DOMException to match browser behavior
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
            writable: false,
            configurable: true,
            value: async function() {
                const error = new DOMException(
                    'Permission denied',
                    'NotAllowedError'
                );
                throw error;
            }
        });
    """)

    # Now navigate to the app
    page.goto(build_app_url(app_base_url, path="/"))
    wait_for_app_loaded(page)
    return page


_MAX_PIXEL_THRESHOLD: Final[float] = 0.10


class ImageCompareFunction(Protocol):
    def __call__(
        self,
        element: ElementHandle | Locator | Page,
        *,
        image_threshold: float = 0.002,
        pixel_threshold: float = 0.05,
        name: str | None = None,
        fail_fast: bool = False,
        style: str | None = None,
    ) -> None:
        """Compare a screenshot with screenshot from a past run.

        Parameters
        ----------
        element : ElementHandle or Locator
            The element to take a screenshot of.
        image_threshold : float, optional
            The allowed percentage of different pixels in the image.
        pixel_threshold : float, optional
            Per-pixel comparison threshold passed to ``pixelmatch`` (0.0-1.0).
            Values above 0.10 are disallowed because they make snapshot comparisons
            too permissive.
        name : str | None, optional
            The name of the screenshot without an extension. If not provided, the name
            of the test function will be used.
        fail_fast : bool, optional
            If True, the comparison will stop at the first pixel mismatch.
        """


@pytest.fixture(scope="session", autouse=True)
def delete_output_dir(pytestconfig: Any) -> None:
    # Overwriting the default delete_output_dir fixture from pytest-playwright:
    # There seems to be a bug with the combination of pytest-playwright, xdist,
    # and pytest-rerunfailures where the output dir is deleted when it shouldn't be.
    # To prevent this issue, we are not deleting the output dir when running with
    # reruns and xdist.

    uses_xdist = (
        pytestconfig.getoption("workerinput", None) or os.getenv("PYTEST_XDIST_WORKER"),
    )
    uses_reruns = pytestconfig.getoption("reruns", None)

    if not (uses_xdist and uses_reruns):
        # Delete the output folder. Uses the same logic as the default
        # delete_output_dir fixture from pytest-playwright:
        # https://github.com/microsoft/playwright-pytest/blob/fb51327390ccbd3561c1777499934eb88296f1bf/pytest-playwright/pytest_playwright/pytest_playwright.py#L68
        output_dir = pytestconfig.getoption("--output")
        if os.path.exists(output_dir):
            try:
                shutil.rmtree(output_dir)
            except FileNotFoundError:
                # When running in parallel, another thread may have already deleted the
                # files
                pass
            except OSError as error:
                if error.errno != 16:
                    raise
                # We failed to remove folder, might be due to the whole folder being
                # mounted inside a container:
                #   https://github.com/microsoft/playwright/issues/12106
                #   https://github.com/microsoft/playwright-python/issues/1781
                # Do a best-effort to remove all files inside of it instead.
                entries = os.listdir(output_dir)
                for entry in entries:
                    shutil.rmtree(entry)


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
    return Path(
        get_git_root() / "e2e_playwright" / pytestconfig.getoption("--output")
    ).resolve()


@pytest.fixture
def assert_snapshot(
    request: pytest.FixtureRequest,
    output_folder: Path,
    pytestconfig: Any,
) -> Generator[ImageCompareFunction, None, None]:
    """Fixture that compares a screenshot with screenshot from a past run."""

    # Check if reruns are enabled for this test run
    flaky_marker = request.node.get_closest_marker("flaky")
    if flaky_marker and "reruns" in flaky_marker.kwargs:
        configured_reruns = flaky_marker.kwargs["reruns"]
    else:
        configured_reruns = pytestconfig.getoption("reruns", 0)
    # Get the current execution count:
    execution_count = getattr(request.node, "execution_count", 1)
    # True if this is the last rerun (or the only test run)
    is_last_rerun = execution_count - 1 == configured_reruns

    root_path = get_git_root()

    platform = str(sys.platform)
    module_name = request.module.__name__.split(".")[-1]
    test_function_name = request.node.originalname

    snapshot_dir: Path = (
        root_path / "e2e_playwright" / "__snapshots__" / platform / module_name
    )

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
        style: str | None = None,
        show_app_header: bool | None = None,
    ) -> None:
        """Compare a screenshot with screenshot from a past run.

        Parameters
        ----------
        element : ElementHandle or Locator
            The element to take a screenshot of.
        image_threshold : float, optional
            The allowed percentage of different pixels in the image.
        pixel_threshold : float, optional
            Per-pixel comparison threshold passed to ``pixelmatch`` (0.0-1.0).
            Values above 0.10 are disallowed because they make snapshot comparisons
            too permissive.
        name : str | None, optional
            The name of the screenshot without an extension. If not provided, the name
            of the test function will be used.
        fail_fast : bool, optional
            If True, the comparison will stop at the first pixel mismatch.
        file_type: "png" or "jpg"
            The file type of the screenshot. Defaults to "png".
        show_app_header : bool or None
            Whether to make the app header background transparent before taking the screenshot.
            If None (default), the app header will be shown based on the
            element type (page will always show the app header, other elements will hide it).
        """
        nonlocal \
            test_failure_messages, \
            snapshot_default_file_name, \
            module_snapshot_updates_dir, \
            module_snapshot_failures_dir, \
            snapshot_file_suffix

        if not (0.0 <= pixel_threshold <= _MAX_PIXEL_THRESHOLD):
            raise ValueError(
                f"pixel_threshold must be between 0.0 and {_MAX_PIXEL_THRESHOLD:.2f} "
                f"(got {pixel_threshold}). This value is passed to pixelmatch's "
                "per-pixel comparison threshold; higher values make snapshot "
                "comparisons too permissive."
            )

        if show_app_header is False or (
            show_app_header is None and not isinstance(element, Page)
        ):
            # Make the app header background transparent:
            if style is None:
                style = ""
            style += " .stAppHeader { background: transparent; }"

        if file_type == "jpg":
            file_extension = ".jpg"
            img_bytes = element.screenshot(
                type="jpeg", quality=90, animations="disabled", style=style
            )

        else:
            file_extension = ".png"
            img_bytes = element.screenshot(
                type="png", animations="disabled", style=style
            )

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
        error_msg: str = "Unknown error"

        try:
            mismatch = pixelmatch(
                img_a,
                img_b,
                img_diff,
                threshold=pixel_threshold,
                fail_fast=fail_fast,
                alpha=0,
            )

            total_pixels = img_a.size[0] * img_a.size[1]
            max_diff_pixels = int(image_threshold * total_pixels)

            if mismatch < max_diff_pixels:
                return

            error_msg = (
                f"Snapshot mismatch for {snapshot_file_name} ({mismatch} pixels difference;"
                f" {mismatch / total_pixels * 100:.2f}%)"
            )

            # Create new failures folder for this test:
            test_failures_dir.mkdir(parents=True, exist_ok=True)
            img_diff.save(
                f"{test_failures_dir}/diff_{snapshot_file_name}{file_extension}"
            )
            img_a.save(
                f"{test_failures_dir}/actual_{snapshot_file_name}{file_extension}"
            )
            img_b.save(
                f"{test_failures_dir}/expected_{snapshot_file_name}{file_extension}"
            )
        except ValueError as ex:
            # Create new failures folder for this test:
            test_failures_dir.mkdir(parents=True, exist_ok=True)
            img_a.save(
                f"{test_failures_dir}/actual_{snapshot_file_name}{file_extension}"
            )
            img_b.save(
                f"{test_failures_dir}/expected_{snapshot_file_name}{file_extension}"
            )
            # ValueError is thrown when the images have different sizes
            # Calculate the relative difference in total pixels
            expected_pixels = img_b.size[0] * img_b.size[1]
            actual_pixels = img_a.size[0] * img_a.size[1]
            pixel_diff = abs(expected_pixels - actual_pixels)

            error_msg = (
                f"Snapshot mismatch for {snapshot_file_name}. "
                f"Wrong size: expected={img_b.size}, actual={img_a.size} "
                f"({pixel_diff} pixels difference; "
                f"{pixel_diff / expected_pixels * 100:.2f}%). "
                f"Error: {ex}"
            )

        if is_last_rerun:
            # If its the last rerun (or the only test run), update snapshots
            # and fail after all the other snapshots have been updated in the given
            # test.
            snapshot_updates_file_path.parent.mkdir(parents=True, exist_ok=True)
            snapshot_updates_file_path.write_bytes(img_bytes)
            # Add error to the list of test failures:
            test_failure_messages.append(error_msg)
        else:
            # If there are other test reruns that will follow, fail immediately
            # and avoid updating the snapshot. Failing here will correctly show a
            # test error in the Github UI, which enables our flaky test tracking
            # tool to work correctly.
            pytest.fail(error_msg)

    yield compare

    if test_failure_messages:
        pytest.fail(
            "Missing or mismatched snapshots: \n" + "\n".join(test_failure_messages)
        )


@pytest.fixture(autouse=True)
def playwright_profiling(
    request: pytest.FixtureRequest, page: Page
) -> Generator[None, None, None]:
    if request.node.get_closest_marker("no_perf") or not is_supported_browser(page):
        yield
        return

    with measure_performance(page, test_name=request.node.name):
        yield


# endregion


# region Public utility methods


def wait_for_app_run(
    page_or_locator: Page | Locator | FrameLocator,
    wait_delay: int = 100,
    initial_wait: int = 210,
) -> None:
    """Wait for the given page to finish running.

    Parameters
    ----------
    page_or_locator : Page | Locator | FrameLocator
        The page or locator to wait for.
    wait_delay : int, optional
        The delay to wait for the rerun to finish.
    initial_wait : int, optional
        The initial wait before checking for the rerun to finish.
        This is needed for some widgets that have a debounce timeout.
        For example, pydeck charts have a debounce timeout of 200ms.
    """

    page: Page
    if isinstance(page_or_locator, Locator):
        page = page_or_locator.page
    elif isinstance(page_or_locator, FrameLocator):
        page = page_or_locator.owner.page
    else:
        page = page_or_locator

    page.wait_for_timeout(initial_wait)

    if isinstance(page_or_locator, StaticPage):
        # Check that static connection established.
        page_or_locator.locator(
            "[data-testid='stApp'][data-test-connection-state='STATIC_CONNECTED']"
        ).wait_for(
            timeout=25000,
            state="attached",
        )
    else:
        # Make sure that the websocket connection is established.
        page_or_locator.locator(
            "[data-testid='stApp'][data-test-connection-state='CONNECTED']"
        ).wait_for(
            timeout=25000,
            state="attached",
        )

    # Wait until we know the script has started. We determine this by checking
    # whether the app is in notRunning state. (The data-test-connection-state attribute
    # goes through the sequence "initial" -> "running" -> "notRunning").
    page_or_locator.locator(
        "[data-testid='stApp'][data-test-script-state='notRunning']"
    ).wait_for(
        timeout=25000,
        state="attached",
    )

    # Wait for all element skeletons to be removed.
    # This is useful to make sure that all elements have been rendered.
    expect(page_or_locator.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)

    if wait_delay > 0:
        # Give the app a little more time to render everything
        page.wait_for_timeout(wait_delay)


def wait_for_app_loaded(page: Page) -> None:
    """Wait for the app to fully load."""
    # Wait for the app view container to appear:
    page.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )

    wait_for_app_run(page)


def rerun_app(page: Page) -> None:
    """Triggers an app rerun and waits for the run to be finished."""
    # Click somewhere to clear the focus from elements:
    page.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    # Press "r" to rerun the app:
    page.keyboard.press("r")
    wait_for_app_run(page)


def wait_until(
    page: Page, fn: Callable[[], bool | None], timeout: int = 5000, interval: int = 100
) -> None:
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

    def timed_out() -> bool:
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
            if result not in {None, True, False}:
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


def start_app_server(
    app_port: int,
    request_module: ModuleType,
    *,
    extra_env: dict[str, str] | None = None,
    extra_args: list[str] | None = None,
) -> AsyncSubprocess:
    """Start a Streamlit app server for the given *test module*.

    This helper centralizes the logic for spinning up a Streamlit subprocess so
    it can be reused by different pytest fixtures (for example, tests that
    require per-test environment variables).

    Parameters
    ----------
    app_port : int
        Port on which the server should listen.
    request_module : ModuleType
        The pytest *module object* that triggered the server start. This is
        needed to resolve the Streamlit script that belongs to the test.
    extra_env : dict[str, str] | None, optional
        Additional environment variables to set for the subprocess.
    extra_args : list[str] | None, optional
        Additional command-line arguments to pass to *streamlit run*.

    Returns
    -------
    AsyncSubprocess
        The running Streamlit subprocess wrapper. *Call ``terminate()`` on the
        returned object to stop the server and obtain the captured output.*
    """
    env = {**os.environ.copy(), **(extra_env or {})}

    args = [
        "streamlit",
        "run",
        resolve_test_to_script(request_module),
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
        "--server.scriptHealthCheckEnabled",
        "true",
    ]

    app_server_start_retries = 3
    app_server_start_retry_delay_seconds = 20

    # Append any caller-supplied extra args at the end so they can override
    # defaults when necessary.
    if extra_args:
        args.extend(extra_args)

    for i in range(app_server_start_retries):
        proc = AsyncSubprocess(args, cwd=".", env=env)
        proc.start()

        if wait_for_app_server_to_start(app_port):
            return proc

        stdout = proc.terminate()
        print(stdout, flush=True)
        if i < app_server_start_retries - 1:
            print(
                f"Retrying to start app server in {app_server_start_retry_delay_seconds} seconds... "
                f"(Attempt {i + 1}/{app_server_start_retries})",
                flush=True,
            )
            time.sleep(app_server_start_retry_delay_seconds)

    raise RuntimeError("Unable to start Streamlit app")


# endregion
