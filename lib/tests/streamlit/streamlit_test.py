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


def get_version():
    """Get version by parsing out setup.py."""
    dirname = os.path.dirname(__file__)
    base_dir = os.path.abspath(os.path.join(dirname, "../.."))
    pattern = re.compile(r"(?:.*VERSION = \")(?P<version>.*)(?:\"  # PEP-440$)")
    for line in open(os.path.join(base_dir, "setup.py")).readlines():
        m = pattern.match(line)
        if m:
            return m.group("version")


class StreamlitTest(unittest.TestCase):
    """Test Streamlit.__init__.py."""

    def test_streamlit_version(self):
        """Test streamlit.__version__."""
        self.assertEqual(__version__, get_version())

    def test_get_option(self):
        """Test streamlit.get_option."""
        # This is set in lib/tests/conftest.py to False
        self.assertEqual(False, st.get_option("browser.gatherUsageStats"))

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

    def test_public_api(self):
        """Test that we don't accidentally remove (or add) symbols
        to the public `st` API.
        """
        api = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }
        self.assertEqual(
            api,
            {
                # DeltaGenerator methods:
                "altair_chart",
                "area_chart",
                "audio",
                "balloons",
                "bar_chart",
                "bokeh_chart",
                "button",
                "button_group",
                "caption",
                "camera_input",
                "chat_input",
                "chat_message",
                "checkbox",
                "code",
                "columns",
                "context",
                "tabs",
                "container",
                "dataframe",
                "data_editor",
                "date_input",
                "dialog",
                "divider",
                "download_button",
                "expander",
                "pydeck_chart",
                "empty",
                "error",
                "exception",
                "feedback",
                "file_uploader",
                "form",
                "form_submit_button",
                "graphviz_chart",
                "header",
                "help",
                "html",
                "image",
                "info",
                "json",
                "latex",
                "line_chart",
                "link_button",
                "logo",
                "map",
                "markdown",
                "metric",
                "multiselect",
                "number_input",
                "page_link",
                "pills",
                "plotly_chart",
                "popover",
                "progress",
                "pyplot",
                "radio",
                "scatter_chart",
                "selectbox",
                "select_slider",
                "slider",
                "snow",
                "subheader",
                "success",
                "status",
                "table",
                "text",
                "text_area",
                "text_input",
                "time_input",
                "title",
                "toast",
                "toggle",
                "vega_lite_chart",
                "video",
                "warning",
                "write",
                "write_stream",
                "color_picker",
                "sidebar",
                # Other modules the user should have access to:
                "echo",
                "spinner",
                "set_page_config",
                "stop",
                "rerun",
                "switch_page",
                "cache",
                "secrets",
                "session_state",
                "query_params",
                "cache_data",
                "cache_resource",
                "navigation",
                "Page",
                "fragment",
                # Experimental APIs:
                "experimental_dialog",
                "experimental_fragment",
                "experimental_get_query_params",
                "experimental_set_query_params",
                "experimental_user",
                "get_option",
                "set_option",
                "connection",
            },
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
            self.assertIn("Help on package streamlit:", output)
        finally:
            os.chdir(cwd)
