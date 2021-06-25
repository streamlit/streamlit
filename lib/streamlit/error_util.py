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

import os
import traceback

import streamlit as st
from streamlit import config
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


# Extract the streamlit package path
_streamlit_dir = os.path.dirname(st.__file__)

# Make it absolute, resolve aliases, and ensure there's a trailing path
# separator
_streamlit_dir = os.path.join(os.path.realpath(_streamlit_dir), "")

# When client.showErrorDetails is False, we show a generic warning in the
# frontend when we encounter an uncaught app exception.
_GENERIC_UNCAUGHT_EXCEPTION_TEXT = (
    "Whoops — something went wrong! An error has been logged."
)


def handle_uncaught_app_exception(e: BaseException) -> None:
    """Handle an exception that originated from a user app.
    By default, we show exceptions directly in the browser. However,
    if the user has disabled client error details, we display a generic
    warning in the frontend instead.
    """
    if config.get_option("client.showErrorDetails"):
        LOGGER.warning(traceback.format_exc())
        st.exception(e)
        # TODO: Clean up the stack trace, so it doesn't include ScriptRunner.
    else:
        # Use LOGGER.error, rather than LOGGER.debug, since we don't
        # show debug logs by default.
        LOGGER.error("Uncaught app exception", exc_info=e)
        st.error(_GENERIC_UNCAUGHT_EXCEPTION_TEXT)


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
