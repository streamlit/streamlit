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

"""Streamlit Unit test."""

import os
import re
import subprocess
import sys
import tempfile
import unittest

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
                "caption",
                "camera_input",
                "checkbox",
                "code",
                "columns",
                "tabs",
                "container",
                "dataframe",
                "date_input",
                "divider",
                "download_button",
                "expander",
                "pydeck_chart",
                "empty",
                "error",
                "exception",
                "file_uploader",
                "form",
                "form_submit_button",
                "graphviz_chart",
                "header",
                "help",
                "image",
                "info",
                "json",
                "latex",
                "line_chart",
                "map",
                "markdown",
                "metric",
                "multiselect",
                "number_input",
                "plotly_chart",
                "progress",
                "pyplot",
                "radio",
                "selectbox",
                "select_slider",
                "slider",
                "snow",
                "subheader",
                "success",
                "table",
                "text",
                "text_area",
                "text_input",
                "time_input",
                "title",
                "vega_lite_chart",
                "video",
                "warning",
                "write",
                "color_picker",
                "sidebar",
                # Other modules the user should have access to:
                "echo",
                "spinner",
                "set_page_config",
                "stop",
                "cache",
                "secrets",
                "session_state",
                "cache_data",
                "cache_resource",
                # Experimental APIs:
                "experimental_user",
                "experimental_singleton",
                "experimental_memo",
                "experimental_get_query_params",
                "experimental_set_query_params",
                "experimental_rerun",
                "experimental_show",
                "experimental_data_editor",
                "experimental_connection",
                "get_option",
                "set_option",
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
