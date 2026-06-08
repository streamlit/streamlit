# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Tests for starlette_server_config."""

from __future__ import annotations

from streamlit.web.server.starlette import starlette_server_config


def test_server_cookie_names_match_cloud_allowlist() -> None:
    """Guard that fails when a server cookie is added or renamed.

    The Streamlit Community Cloud proxy only forwards an allowlist of known
    cookies to the app; any cookie not on it is stripped before the request
    reaches the app. A new cookie therefore works locally but silently breaks on
    Community Cloud -- this is exactly what broke ``st.login`` via
    ``_streamlit_session``.

    To catch *added* cookies (not just renamed ones), this discovers every
    ``*_COOKIE_NAME`` constant in ``starlette_server_config`` rather than listing
    them by hand. This relies on the convention that all server cookie names are
    defined there as ``*_COOKIE_NAME`` constants.

    If this test fails because you added or renamed a cookie, make sure the new
    cookie is allowlisted by the Community Cloud proxy, then update
    ``expected_cookie_names`` below to match.

    Note: this guards the base cookie *names*. Chunk suffixes
    (``_streamlit_user_1`` etc.) are covered by the proxy's allowlist entry for
    the base name, so they are intentionally not listed here.
    """
    actual_cookie_names = {
        value
        for name, value in vars(starlette_server_config).items()
        if name.endswith("_COOKIE_NAME") and isinstance(value, str)
    }

    # Keep in sync with the Community Cloud proxy cookie allowlist.
    expected_cookie_names = {
        "_streamlit_user",
        "_streamlit_user_tokens",
        "_streamlit_xsrf",
        "_streamlit_session",
    }

    assert actual_cookie_names == expected_cookie_names, (
        "Server cookie names changed. Ensure the new cookie is allowlisted by "
        "the Streamlit Community Cloud proxy before updating this test, or it "
        "will be stripped on Cloud."
    )
