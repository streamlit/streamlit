# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
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

from unittest.mock import patch, mock_open
import os

# Do not import any Streamlit modules here! See below for details.

os.environ["HOME"] = "/mock/home/folder"

CONFIG_FILE_CONTENTS = """
[global]
sharingMode = "off"
unitTest = true

[browser]
gatherUsageStats = false
"""

with patch(
    "streamlit.config.open", mock_open(read_data=CONFIG_FILE_CONTENTS), create=True
), patch("streamlit.config.os.path.exists") as path_exists:
    # Import streamlit even if we don't do anything with it below as we want to
    # be sure to catch any instances of calling config.get_option() when
    # first importing a file. We disallow this because doing so means that we
    # miss config options set via flag or environment variable.
    import streamlit as st

    from streamlit import file_util
    from streamlit import config

    assert (
        not config._config_options
    ), "config.get_option() should not be called on file import!"

    config_path = file_util.get_streamlit_file_path("config.toml")
    path_exists.side_effect = lambda path: path == config_path

    # Force a reparse of our config options with CONFIG_FILE_CONTENTS so the
    # result gets cached.
    config.get_config_options(force_reparse=True)
