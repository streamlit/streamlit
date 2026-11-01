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

from __future__ import annotations

from streamlit.web.server.request_locality import classify_remote_ip, is_direct_loopback


def test_classify_loopback_ipv4() -> None:
    """127.0.0.1 is a direct loopback peer."""
    assert classify_remote_ip("127.0.0.1") == "loopback"
    assert is_direct_loopback("127.0.0.1")


def test_classify_loopback_ipv6() -> None:
    """::1 is a direct loopback peer."""
    assert classify_remote_ip("::1") == "loopback"


def test_classify_private_is_not_loopback() -> None:
    """RFC1918 addresses are private, not eligible loopback."""
    assert classify_remote_ip("10.0.0.1") == "private"
    assert not is_direct_loopback("10.0.0.1")


def test_classify_unknown_values() -> None:
    """Missing or unparseable addresses are unknown."""
    assert classify_remote_ip(None) == "unknown"
    assert classify_remote_ip("testclient") == "unknown"
    assert not is_direct_loopback(None)
