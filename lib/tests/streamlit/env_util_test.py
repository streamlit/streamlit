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

"""Tests streamlit.env_util."""

from __future__ import annotations

import os
from unittest.mock import mock_open, patch

from streamlit import env_util


def test_is_wsl_false_for_non_linux() -> None:
    """WSL detection is skipped on non-Linux/BSD systems, even with WSL env vars."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=False),
        patch.dict(os.environ, {"WSL_DISTRO_NAME": "Ubuntu"}, clear=True),
    ):
        assert not env_util._is_wsl()


def test_is_wsl_true_for_wsl_distro_name_environment_variable() -> None:
    """The WSL_DISTRO_NAME environment variable identifies a WSL environment."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {"WSL_DISTRO_NAME": "Ubuntu"}, clear=True),
    ):
        assert env_util._is_wsl()


def test_is_wsl_true_for_wsl_interop_environment_variable() -> None:
    """The WSL_INTEROP environment variable identifies a WSL environment."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {"WSL_INTEROP": "/run/WSL/1_interop"}, clear=True),
    ):
        assert env_util._is_wsl()


def test_is_wsl_true_for_proc_version() -> None:
    """A "microsoft" marker in /proc/version identifies a WSL environment."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {}, clear=True),
        patch(
            "builtins.open",
            mock_open(read_data="Linux version 5.15.167.4-microsoft-standard-WSL2"),
        ),
    ):
        assert env_util._is_wsl()


def test_is_wsl_true_for_wsl2_kernel_without_microsoft() -> None:
    """A custom WSL2 kernel string (no "microsoft" marker) is detected as WSL."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {}, clear=True),
        patch(
            "builtins.open",
            mock_open(read_data="Linux version 6.6.0-custom-standard-WSL2"),
        ),
    ):
        assert env_util._is_wsl()


def test_is_wsl_false_for_native_linux() -> None:
    """Native Linux (no WSL env vars, non-WSL kernel string) is not detected as WSL."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {}, clear=True),
        patch(
            "builtins.open",
            mock_open(read_data="Linux version 5.15.0-generic (gcc 11.2.0)"),
        ),
    ):
        assert not env_util._is_wsl()


def test_is_wsl_false_for_unrelated_wsl_substring() -> None:
    """A bare "wsl" substring in an otherwise native kernel string is not WSL."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {}, clear=True),
        patch(
            "builtins.open",
            mock_open(read_data="Linux version 5.15.0-generic (build@host-wsl-lab)"),
        ),
    ):
        assert not env_util._is_wsl()


def test_is_wsl_false_when_proc_version_is_unavailable() -> None:
    """WSL detection returns False when /proc/version cannot be read."""
    with (
        patch.object(env_util, "IS_LINUX_OR_BSD", new=True),
        patch.dict(os.environ, {}, clear=True),
        patch("builtins.open", side_effect=OSError),
    ):
        assert not env_util._is_wsl()
