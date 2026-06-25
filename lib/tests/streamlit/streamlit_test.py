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

"""Streamlit Unit test."""

from __future__ import annotations

import os
import re
import statistics
import subprocess
import sys
import tempfile
import unittest

# tomllib is available in Python 3.11+, use tomli as fallback for Python 3.10
try:
    import tomllib
except ImportError:
    import tomli as tomllib

import matplotlib as mpl
import pytest

import streamlit as st
from streamlit import __version__
from tests.streamlit.element_mocks import (
    CONTAINER_ELEMENTS,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)


def get_version() -> str | None:
    """Get version by parsing pyproject.toml."""
    dirname = os.path.dirname(__file__)
    base_dir = os.path.abspath(os.path.join(dirname, "../.."))
    pyproject_path = os.path.join(base_dir, "pyproject.toml")

    with open(pyproject_path, "rb") as f:
        pyproject = tomllib.load(f)

    return pyproject.get("project", {}).get("version")


# Commands that don't result in rendered elements in the frontend
NON_ELEMENT_COMMANDS: set[str] = {
    "App",
    "Page",
    "bottom",
    "cache",
    "cache_data",
    "cache_resource",
    "connection",
    "context",
    "fragment",
    "get_option",
    "login",
    "logout",
    "navigation",
    "query_params",
    "rerun",
    "secrets",
    "session_state",
    "set_option",
    "set_page_config",
    "sidebar",
    "stop",
    "switch_page",
    "user",
}

# Element commands that are exposed on the DeltaGenerator
# and on the top-level Streamlit namespace.
# We extract them from the element mocks.
ELEMENT_COMMANDS: set[str] = {
    command for command, _ in WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS + CONTAINER_ELEMENTS
}

# Public commands intentionally omitted from the api-reference.md skill doc
# (e.g. internal commands not meant for app authors). Add a command here only
# if it should stay out of the reference; deprecated commands are still
# documented (with a deprecation note), so they don't belong in this set.
API_REFERENCE_EXCLUSIONS: set[str] = set()


class StreamlitTest(unittest.TestCase):
    """Test Streamlit.__init__.py."""

    def test_streamlit_version(self):
        """Test streamlit.__version__."""
        assert __version__ == get_version()

    def test_get_option(self):
        """Test streamlit.get_option."""
        # This is set in lib/tests/conftest.py to False
        assert not st.get_option("browser.gatherUsageStats")

    def test_matplotlib_uses_agg(self):
        """Test that Streamlit uses the 'Agg' backend for matplotlib."""
        ORIG_PLATFORM = sys.platform

        for platform in ["darwin", "linux2"]:
            sys.platform = platform

            assert mpl.get_backend().lower() == "agg"
            assert os.environ.get("MPLBACKEND").lower() == "agg"

            # Force matplotlib to use a different backend
            mpl.use("pdf", force=True)
            assert mpl.get_backend().lower() == "pdf"

            # Reset the backend to 'Agg'
            mpl.use("agg", force=True)
            assert mpl.get_backend().lower() == "agg"
        sys.platform = ORIG_PLATFORM

    def test_ensure_completeness_element_mocks(self):
        """Test that we have mocked all elements in the public API.

        The full public API should be covered by:
        - element_mocks.WIDGET_ELEMENTS
        - element_mocks.NON_WIDGET_ELEMENTS
        - element_mocks.CONTAINER_ELEMENTS
        - NON_ELEMENT_COMMANDS
        """
        api = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }

        mocked_elements = {
            element
            for element, _ in WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS + CONTAINER_ELEMENTS
        }
        mocked_elements.update(NON_ELEMENT_COMMANDS)
        assert api == mocked_elements, (
            "There are new public commands that might be needed to be added to element "
            "mocks or NON_ELEMENT_COMMANDS. Please add it to the correct list of "
            "mocked elements or NON_ELEMENT_COMMANDS."
        )

    def test_public_api(self):
        """Test that we don't accidentally remove (or add) symbols
        to the public `st` API.
        """
        api = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }
        assert api == ELEMENT_COMMANDS.union(NON_ELEMENT_COMMANDS)

    def test_api_reference_doc_covers_public_api(self):
        """Test that the api-reference.md skill doc stays in sync with the API.

        The reference tables are hand-maintained, so this guards against them
        silently drifting when new public commands or ``st.column_config``
        helpers are added. Only names are checked, not their descriptions.
        """
        dirname = os.path.dirname(__file__)
        lib_dir = os.path.abspath(os.path.join(dirname, "..", ".."))
        reference_path = os.path.join(
            lib_dir,
            "streamlit",
            ".agents",
            "skills",
            "developing-with-streamlit",
            "references",
            "api-reference.md",
        )
        with open(reference_path, encoding="utf-8") as f:
            reference = f.read()

        # Top-level public commands (mirrors test_public_api).
        top_level_api = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }
        documented = set(
            re.findall(r"^\| `st\.([A-Za-z0-9_]+)` \|", reference, re.MULTILINE)
        )
        missing = top_level_api - documented - API_REFERENCE_EXCLUSIONS
        assert not missing, (
            "These public st commands are missing from api-reference.md: "
            f"{sorted(missing)}. Add them to the reference or, if intentionally "
            "omitted, to API_REFERENCE_EXCLUSIONS."
        )

        # Reverse direction: every documented top-level ``st.<name>`` entry must
        # still exist on ``st`` so renamed, removed, or typo'd rows are caught.
        phantom = {name for name in documented if not hasattr(st, name)}
        assert not phantom, (
            "These commands are documented in api-reference.md but no longer "
            f"exist on the public st API: {sorted(phantom)}. Remove or fix them."
        )

        # st.column_config helpers. ``annotations`` is the leaked
        # ``from __future__ import annotations`` symbol, not a real helper.
        column_config_api = {
            k for k in dir(st.column_config) if not k.startswith("_")
        } - {"annotations"}
        documented_column_config = set(
            re.findall(
                r"^\| `st\.column_config\.([A-Za-z0-9_]+)` \|",
                reference,
                re.MULTILINE,
            )
        )
        missing_column_config = column_config_api - documented_column_config
        assert not missing_column_config, (
            "These st.column_config helpers are missing from api-reference.md: "
            f"{sorted(missing_column_config)}."
        )

        # Reverse direction for ``st.column_config`` so removed or renamed
        # helpers documented in the reference are caught.
        phantom_column_config = {
            name
            for name in documented_column_config
            if not hasattr(st.column_config, name)
        }
        assert not phantom_column_config, (
            "These st.column_config helpers are documented in api-reference.md "
            f"but no longer exist: {sorted(phantom_column_config)}. Remove or fix "
            "them."
        )

    def test_pydoc(self):
        """Test that we can run pydoc on the streamlit package"""
        cwd = os.getcwd()
        try:
            os.chdir(tempfile.mkdtemp())
            # Run the script as a separate process to make sure that
            # the currently loaded modules do not affect the test result.
            output = subprocess.check_output(
                [sys.executable, "-m", "pydoc", "streamlit"]
            ).decode()
            assert "Help on package streamlit:" in output
        finally:
            os.chdir(cwd)


@pytest.mark.usefixtures("benchmark")
def test_cold_import_time(benchmark):
    """
    Measure the import time of `streamlit` by spawning a new Python subprocess.

    This simulates a “cold” import because each run starts a fresh
    interpreter session. It includes Python startup overhead, so it
    approximates how a user experiences an import in a newly launched
    Python process.
    """

    def do_cold_import():
        # We invoke a separate Python process that just imports the package.
        subprocess.check_call([sys.executable, "-c", "import streamlit"])

    benchmark(do_cold_import)


def test_importtime_median_under_threshold():
    """
    Measure the import time of Streamlit via the built-in `importtime`
    in a fresh interpreter, compute the median import time,
    and check if it's under a static threshold.
    """
    # Define an acceptable threshold for import time (in microseconds).
    # This value is also dependent a bit on the machine it's run on,
    # so needs to be mainly adjusted to our CI runners.
    # While its important to keep the import time low, you can
    # modify this threshold if it's really needed to add some new features.
    # But make sure that its justified and intended.
    max_allowed_import_time_us = 700_000

    import_times = []

    for _ in range(25):
        # Spawn a subprocess that imports `streamlit` with Python's importtime
        # instrumentation
        cmd = [sys.executable, "-X", "importtime", "-c", "import streamlit"]
        p = subprocess.run(cmd, stderr=subprocess.PIPE, check=True)

        # The last line of stderr has the total import time:
        # import time: self [us] | cumulative [us] | streamlit
        line = p.stderr.splitlines()[-1]
        field = line.split(b"|")[-2].strip()  # e.g. b"123456"
        total_us = int(field)  # convert to integer microseconds
        import_times.append(total_us)

    # Calculate the median import time across all runs
    median_time_us = statistics.median(import_times)

    # Check if the median is within the desired threshold
    assert median_time_us <= max_allowed_import_time_us, (
        f"Median import time {round(median_time_us)}us of streamlit exceeded the max "
        f"allowed threshold {max_allowed_import_time_us}us (percentage: "
        f"{round(median_time_us / max_allowed_import_time_us * 100)}%)."
        "In case this is expected and justified, you can change the "
        "threshold in the test."
    )
