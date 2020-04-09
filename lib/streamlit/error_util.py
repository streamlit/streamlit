# -*- coding: utf-8 -*-
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

import os
import traceback

import streamlit as st


# Extract the streamlit package path
_streamlit_dir = os.path.dirname(st.__file__)

# Make it absolute, resolve aliases, and ensure there's a trailing path
# separator
_streamlit_dir = os.path.join(os.path.realpath(_streamlit_dir), "")


def _is_in_streamlit_package(file):
    """True if the given file is part of the streamlit package."""
    try:
        common_prefix = os.path.commonprefix([os.path.realpath(file), _streamlit_dir])
    except ValueError:
        # Raised if paths are on different drives.
        return False

    return common_prefix == _streamlit_dir


def get_nonstreamlit_traceback(extracted_tb):
    return [
        entry for entry in extracted_tb if not _is_in_streamlit_package(entry.filename)
    ]
