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

"""Streamlit Unit test."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import unittest

import matplotlib

import streamlit as st
from streamlit import __version__
from tests.streamlit.element_mocks import (
    CONTAINER_ELEMENTS,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)


def get_version():
    """Get version by parsing out setup.py."""
    dirname = os.path.dirname(__file__)
    base_dir = os.path.abspath(os.path.join(dirname, "../.."))
    pattern = re.compile(r"(?:.*VERSION = \")(?P<version>.*)(?:\"  # PEP-440$)")
    for line in open(os.path.join(base_dir, "setup.py")).readlines():
        m = pattern.match(line)
        if m:
            return m.group("version")


# Commands that don't result in rendered elements in the frontend
NON_ELEMENT_COMMANDS: set[str] = {
    "Page",
    "cache",
    "cache_data",
    "cache_resource",
    "connection",
    "context",
    "experimental_fragment",
    "experimental_get_query_params",
    "experimental_set_query_params",
    "experimental_user",
    "fragment",
    "get_option",
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
}

# Element commands that are exposed on the DeltaGenerator
# and on the top-level Streamlit namespace.
# We extract them from the element mocks.
ELEMENT_COMMANDS: set[str] = {
    command for command, _ in WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS + CONTAINER_ELEMENTS
}


class StreamlitTest(unittest.TestCase):
    """Test Streamlit.__init__.py."""

    def test_streamlit_version(self):
        """Test streamlit.__version__."""
        self.assertEqual(__version__, get_version())

    def test_get_option(self):
        """Test streamlit.get_option."""
        # This is set in lib/tests/conftest.py to False
        self.assertFalse(st.get_option("browser.gatherUsageStats"))

    def test_matplotlib_uses_agg(self):
        """Test that Streamlit uses the 'Agg' backend for matplotlib."""
        ORIG_PLATFORM = sys.platform

        for platform in ["darwin", "linux2"]:
            sys.platform = platform

            self.assertEqual(matplotlib.get_backend().lower(), "agg")
            self.assertEqual(os.environ.get("MPLBACKEND").lower(), "agg")

            # Force matplotlib to use a different backend
            matplotlib.use("pdf", force=True)
            self.assertEqual(matplotlib.get_backend().lower(), "pdf")

            # Reset the backend to 'Agg'
            matplotlib.use("agg", force=True)
            self.assertEqual(matplotlib.get_backend().lower(), "agg")
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
        self.assertEqual(api, ELEMENT_COMMANDS.union(NON_ELEMENT_COMMANDS))

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
            self.assertIn("Help on package streamlit:", output)
        finally:
            os.chdir(cwd)
