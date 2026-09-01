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

from __future__ import annotations

import os
import shlex
import shutil
import webbrowser
from contextlib import contextmanager
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from streamlit import env_util
from streamlit.cli_util import _nonblocking_webbrowser_command, open_browser
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

_URL = "http://some-url"


@contextmanager
def _platform(
    *, windows: bool = False, darwin: bool = False, linux: bool = False
) -> Iterator[None]:
    """Pin env_util OS flags without leaking globals across tests."""
    with (
        patch.object(env_util, "IS_WINDOWS", windows),
        patch.object(env_util, "IS_DARWIN", darwin),
        patch.object(env_util, "IS_LINUX_OR_BSD", linux),
    ):
        yield


def _successful_controller() -> MagicMock:
    controller = MagicMock()
    controller.open.return_value = True
    return controller


@pytest.mark.parametrize(
    ("os_name", "expect_webbrowser_open", "expect_popen_command"),
    [
        ("Linux", False, "xdg-open"),
        ("Windows", True, None),
        ("Darwin", False, "open"),
    ],
    ids=["linux_xdg_open", "windows_webbrowser", "darwin_open"],
)
def test_open_browser_os_default(
    os_name: str, expect_webbrowser_open: bool, expect_popen_command: str | None
) -> None:
    """With an empty browser.command, each OS uses its default handler."""
    with (
        _platform(
            windows=os_name == "Windows",
            darwin=os_name == "Darwin",
            linux=os_name == "Linux",
        ),
        patch_config_options({"browser.command": ""}),
        patch("streamlit.env_util.is_executable_in_path", return_value=True),
        patch("webbrowser.get") as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
    ):
        open_browser(_URL)

        webbrowser_get.assert_not_called()
        assert webbrowser_open.called is expect_webbrowser_open
        if expect_popen_command is None:
            subprocess_popen.assert_not_called()
        else:
            subprocess_popen.assert_called_once()
            assert subprocess_popen.call_args.args[0] == [expect_popen_command, _URL]


def test_open_browser_linux_no_xdg() -> None:
    """Linux without xdg-open falls back to webbrowser.open."""
    with (
        _platform(linux=True),
        patch_config_options({"browser.command": ""}),
        patch("streamlit.env_util.is_executable_in_path", return_value=False),
        patch("webbrowser.get") as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
    ):
        open_browser(_URL)

        webbrowser_get.assert_not_called()
        webbrowser_open.assert_called_once_with(_URL)
        subprocess_popen.assert_not_called()


@pytest.mark.parametrize(
    ("browser_command", "expected_get_arg"),
    [
        ("firefox", "firefox"),
        ("/usr/bin/firefox %s", "/usr/bin/firefox %s &"),
        ("firefox %s &", "firefox %s &"),
        ("firefox %s&", "firefox %s &"),
    ],
    ids=[
        "registered_name",
        "percent_s_appends_ampersand",
        "template_keeps_ampersand",
        "glued_ampersand_is_split",
    ],
)
def test_configured_command_passed_to_webbrowser_get(
    browser_command: str, expected_get_arg: str
) -> None:
    """Pass browser.command to webbrowser.get(), appending & to %s templates."""
    controller = _successful_controller()
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": browser_command}),
        patch("streamlit.cli_util.shutil.which", return_value="/usr/bin/firefox"),
        patch("webbrowser.get", return_value=controller) as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
    ):
        open_browser(_URL)

        webbrowser_get.assert_called_once_with(expected_get_arg)
        controller.open.assert_called_once_with(_URL)
        webbrowser_open.assert_not_called()
        subprocess_popen.assert_not_called()


def test_configured_command_retries_bare_path_as_quoted_template() -> None:
    """If get() fails, retry with a quoted executable path plus '%s &'."""
    path = "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    controller = _successful_controller()
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": path}),
        patch("streamlit.cli_util.shutil.which", return_value=path),
        patch(
            "webbrowser.get",
            side_effect=[webbrowser.Error("unknown"), controller],
        ) as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
    ):
        open_browser(_URL)

        assert webbrowser_get.call_args_list[0].args == (path,)
        assert webbrowser_get.call_args_list[1].args == (f"{shlex.quote(path)} %s &",)
        controller.open.assert_called_once_with(_URL)
        webbrowser_open.assert_not_called()
        subprocess_popen.assert_not_called()


def test_configured_command_falls_back_for_unknown_name() -> None:
    """An unresolvable command logs a warning and uses the OS default."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "definitely-not-a-browser-xyz"}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        warning_args = mock_get_logger.return_value.warning.call_args.args
        assert "browser.command=%r" in warning_args[0]
        assert warning_args[1] == "definitely-not-a-browser-xyz"
        os_default.assert_called_once_with(_URL)


def test_configured_command_falls_back_for_missing_path() -> None:
    """A missing executable path logs a warning and uses the OS default."""
    path = "/definitely/not/a/browser/that/exists"
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": path}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


def test_configured_command_falls_back_for_missing_template_executable() -> None:
    """A %s template whose program does not exist warns and uses the OS default."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "definitely-not-a-browser-xyz %s"}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


def test_configured_command_falls_back_for_malformed_template() -> None:
    """Unmatched quotes in a %s template must not skip the OS-default fallback."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": 'firefox "profile %s'}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


def test_configured_command_falls_back_for_generic_browser() -> None:
    """GenericBrowser.open() waits for the process; fall back instead of blocking."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "lynx"}),
        patch("webbrowser.get", return_value=webbrowser.GenericBrowser("lynx")),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


def test_background_browser_false_does_not_fall_back() -> None:
    """BackgroundBrowser returning False is a successful launch, not a fallback."""
    controller = webbrowser.BackgroundBrowser("true")
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "firefox"}),
        patch("webbrowser.get", return_value=controller),
        patch.object(controller, "open", return_value=False) as mock_open,
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_open.assert_called_once_with(_URL)
        mock_get_logger.assert_not_called()
        os_default.assert_not_called()


@pytest.mark.parametrize(
    "controller",
    [webbrowser.Mozilla("firefox"), webbrowser.MacOSXOSAScript("chrome")],
    ids=["mozilla", "macosx_osascript"],
)
def test_non_background_controller_false_falls_back(
    controller: webbrowser.BaseBrowser,
) -> None:
    """False from UnixBrowser or MacOSXOSAScript is a failed launch; fall back."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "firefox"}),
        patch("webbrowser.get", return_value=controller),
        patch.object(controller, "open", return_value=False) as mock_open,
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_open.assert_called_once_with(_URL)
        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


def test_unix_browser_true_does_not_fall_back() -> None:
    """Mozilla/Chrome controllers are invoked rather than rejected as GenericBrowser."""
    controller = webbrowser.Mozilla("firefox")
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "firefox"}),
        patch("webbrowser.get", return_value=controller),
        patch.object(controller, "open", return_value=True) as mock_open,
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_open.assert_called_once_with(_URL)
        mock_get_logger.assert_not_called()
        os_default.assert_not_called()


@pytest.mark.parametrize(
    "error",
    [OSError("boom"), FileNotFoundError("missing")],
    ids=["raises_os_error", "raises_file_not_found"],
)
def test_configured_command_falls_back_when_open_raises(error: OSError) -> None:
    """If controller.open() raises OSError, log a warning and use the OS default."""
    controller = MagicMock()
    controller.open.side_effect = error
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "firefox"}),
        patch("webbrowser.get", return_value=controller),
        patch("subprocess.Popen") as subprocess_popen,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        controller.open.assert_called_once_with(_URL)
        mock_get_logger.return_value.warning.assert_called_once()
        subprocess_popen.assert_called_once()


@pytest.mark.skipif(os.name == "nt", reason="Windows has no POSIX execute bit")
def test_configured_command_falls_back_for_non_executable_file(tmp_path: Path) -> None:
    """An existing non-executable file must not skip the OS-default fallback."""
    path = tmp_path / "not-a-browser"
    path.write_text("#!/bin/sh\n")
    path.chmod(0o644)
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": str(path)}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        mock_get_logger.return_value.warning.assert_called_once()
        os_default.assert_called_once_with(_URL)


@pytest.mark.skipif(shutil.which("true") is None, reason="true is not on PATH")
def test_immediately_exiting_configured_template_does_not_fall_back() -> None:
    """A %s template that exits immediately must not also open the OS default."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "true %s"}),
        patch("streamlit.cli_util._open_browser_with_os_default") as os_default,
    ):
        open_browser(_URL)

        os_default.assert_not_called()


def test_whitespace_only_command_is_treated_as_unset() -> None:
    """Whitespace-only browser.command uses the OS default with no warning."""
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "   "}),
        patch("webbrowser.get") as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
        patch("streamlit.cli_util._get_logger") as mock_get_logger,
    ):
        open_browser(_URL)

        webbrowser_get.assert_not_called()
        mock_get_logger.assert_not_called()
        subprocess_popen.assert_called_once()
        webbrowser_open.assert_not_called()


def test_open_browser_ignores_server_headless() -> None:
    """open_browser still opens when server.headless is true; headless is bootstrap's job."""
    controller = _successful_controller()
    with (
        _platform(darwin=True),
        patch_config_options({"browser.command": "chrome", "server.headless": True}),
        patch("webbrowser.get", return_value=controller) as webbrowser_get,
        patch("webbrowser.open") as webbrowser_open,
        patch("subprocess.Popen") as subprocess_popen,
    ):
        open_browser(_URL)

        webbrowser_get.assert_called_once_with("chrome")
        controller.open.assert_called_once_with(_URL)
        webbrowser_open.assert_not_called()
        subprocess_popen.assert_not_called()


@pytest.mark.parametrize(
    ("command", "expected"),
    [
        ("firefox", "firefox"),
        ("firefox %s", "firefox %s &"),
        ("firefox %s &", "firefox %s &"),
        ("firefox %s&", "firefox %s &"),
        ("open -a Firefox %s", "open -a Firefox %s &"),
    ],
    ids=[
        "name_unchanged",
        "appends_ampersand",
        "keeps_ampersand",
        "splits_glued_ampersand",
        "open_a_template",
    ],
)
def test_nonblocking_webbrowser_command(command: str, expected: str) -> None:
    """Normalize %s templates so webbrowser.get() uses BackgroundBrowser."""
    assert _nonblocking_webbrowser_command(command) == expected
