# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
Global pytest fixtures. This file is automatically run by pytest before tests
are executed.
"""

from __future__ import annotations

import logging
import os
from typing import Final
from unittest.mock import mock_open, patch

import pytest

_LOGGER: Final = logging.getLogger(__name__)

# Do not import any Streamlit modules here! See below for details.

os.environ["HOME"] = "/mock/home/folder"

CONFIG_FILE_CONTENTS = """
[global]
unitTest = true

[browser]
gatherUsageStats = false
"""

with (
    patch(
        "streamlit.config.open", mock_open(read_data=CONFIG_FILE_CONTENTS), create=True
    ),
    patch("streamlit.config.os.path.exists") as path_exists,
):
    # Import streamlit even if we don't do anything with it below as we want to
    # be sure to catch any instances of calling config.get_option() when
    # first importing a file. We disallow this because doing so means that we
    # miss config options set via flag or environment variable.
    import streamlit as st  # noqa: F401
    from streamlit import config, file_util

    if config._config_options:
        _LOGGER.warning(
            "The config options have been populated already. This can happen if there "
            "is a config file in a supported path. This can lead to unreliable test "
            "execution."
        )

    config_path = file_util.get_streamlit_file_path("config.toml")
    path_exists.side_effect = lambda path: path == config_path

    # Force a reparse of our config options with CONFIG_FILE_CONTENTS so the
    # result gets cached.
    config.get_config_options(force_reparse=True)


def pytest_addoption(parser: pytest.Parser):
    group = parser.getgroup("streamlit")

    group.addoption(
        "--require-integration",
        action="store_true",
        help="only run integration tests. ",
    )


def pytest_configure(config: pytest.Config):
    config.addinivalue_line(
        "markers",
        "require_integration(name): mark test to run only on "
        "when --require-integration option is passed to pytest",
    )

    is_require_integration = config.getoption("--require-integration", default=False)
    if is_require_integration:
        try:
            import snowflake.snowpark  # noqa: F401
        except ImportError:
            raise pytest.UsageError(
                "The snowflake-snowpark-python package is not installed."
            )


def pytest_runtest_setup(item: pytest.Item):
    from streamlit.runtime.pages_manager import PagesManager

    # Ensure the pages directory feature is not set prior to the test
    PagesManager.uses_pages_directory = None

    is_require_integration = item.config.getoption(
        "--require-integration", default=False
    )
    has_require_integration_marker = bool(
        list(item.iter_markers(name="require_integration"))
    )

    if is_require_integration and not has_require_integration_marker:
        pytest.skip(
            f"The test is skipped because it has require_integration marker. "
            f"This tests are only run when --require-integration flag is passed to pytest. "
            f"{item}"
        )
    if not is_require_integration and has_require_integration_marker:
        pytest.skip(
            f"The test is skipped because it does not have the right marker. "
            f"Only tests marked with pytest.mark.require_integration() are run. {item}"
        )


def pytest_collection_modifyitems(config, items):
    """
    Adds the `@pytest.mark.benchmark` marker to tests that use the `benchmark`
    fixture. This marker allows us to run only performance tests when needed.
    """
    for item in items:
        markers = item.get_closest_marker("usefixtures")
        if markers and "benchmark" in markers.args:
            item.add_marker(pytest.mark.performance)


@pytest.fixture
def benchmark(
    benchmark,
    request: pytest.FixtureRequest,
):
    # Check to see that the test has the @pytest.mark.performance mark
    if not request.node.get_closest_marker("performance"):
        raise ValueError(
            "The benchmark fixture can only be used with tests marked with @pytest.mark.performance"
        )

    # If the request is a class, add benchmark to the class so that it can be
    # accessed via `self.benchmark()`. This is most commonly used in unittest
    # classes.
    if request.cls:
        request.cls.benchmark = benchmark

    # For pytest functions, return the benchmark function so that it can be
    # accessed via the fixture.
    return benchmark
