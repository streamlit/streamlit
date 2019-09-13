# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Pytest fixtures.

Everything in this file applies to all tests.  This basically makes the
tests not READ from your local home directory but instead this mock
config.
"""

import os

from contextlib import contextmanager
from mock import patch, mock_open
from streamlit import config


os.environ["HOME"] = "/mock/home/folder"

CONFIG_FILE_CONTENTS = """
[global]
sharingMode = "off"
unitTest = true

[browser]
gatherUsageStats = false
"""

config.parse_config_file(CONFIG_FILE_CONTENTS)
