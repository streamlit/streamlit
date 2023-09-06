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
from unittest.mock import Mock, patch

import streamlit as st


@patch("streamlit.commands.execution_control._LOGGER.warning")
def test_deprecation_warnings(logger_mock: Mock):

    st.experimental_rerun()
    logger_mock.assert_called_once()
    msg = logger_mock.call_args.args[0]
    assert "will be removed" in msg

    logger_mock.reset_mock()
    st.rerun()
    logger_mock.assert_not_called()
