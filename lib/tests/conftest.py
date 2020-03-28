# Copyright 2018-2020 Streamlit Inc.
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

import os

from mock import patch, mock_open

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
    # It is important that no streamlit imports happen outside of this patch
    # context. Some Streamlit modules read config values at import time, which
    # will cause config.toml to be read. We need to ensure that the mock config
    # is read instead of the user's actual config.
    from streamlit import file_util
    from streamlit import config

    config_path = file_util.get_streamlit_file_path("config.toml")
    path_exists.side_effect = lambda path: path == config_path

    config.parse_config_file(force=True)
