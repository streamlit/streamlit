# Copyright 2018-2022 Streamlit Inc.
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

import traceback

import streamlit as st
from streamlit import config
from streamlit.logger import get_logger
from streamlit.errors import UncaughtAppException

LOGGER = get_logger(__name__)


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
        st.exception(UncaughtAppException(e))
