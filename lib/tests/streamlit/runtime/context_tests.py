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

from __future__ import annotations

from http.cookies import Morsel
from unittest.mock import MagicMock, patch

from tornado.httputil import HTTPHeaders

import streamlit as st
from tests.streamlit.web.server.server_test_case import ServerTestCase


class StContextTest(ServerTestCase):
    mocked_cookie = Morsel()
    mocked_cookie.set("cookieName", "cookieValue", "cookieValue")

    @patch(
        "streamlit.runtime.context._get_session_client",
        MagicMock(
            return_value=MagicMock(
                request=MagicMock(headers=HTTPHeaders({"the-header": "header-value"}))
            )
        ),
    )
    def test_context_headers(self):
        """Test that `st.context.headers` returns headers from ScriptRunContext"""
        self.assertEqual(st.context.headers.to_dict(), {"The-Header": "header-value"})

    @patch(
        "streamlit.runtime.context._get_session_client",
        MagicMock(
            return_value=MagicMock(
                request=MagicMock(cookies={"cookieName": mocked_cookie})
            )
        ),
    )
    def test_context_cookies(self):
        """Test that `st.context.cookies` returns cookies from ScriptRunContext"""
        self.assertEqual(st.context.cookies.to_dict(), {"cookieName": "cookieValue"})
