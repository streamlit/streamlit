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

"""Classify the TCP peer of an HTTP or WebSocket connection."""

from __future__ import annotations

from ipaddress import ip_address


def classify_remote_ip(remote_ip: str | None) -> str:
    """Classify a peer IP for loopback-only eligibility checks.

    Returns one of ``"loopback"``, ``"private"``, ``"other"``, or ``"unknown"``.
    """
    if remote_ip is None:
        return "unknown"
    try:
        ip = ip_address(remote_ip)
    except ValueError:
        return "unknown"
    if ip.is_loopback:
        return "loopback"
    if ip.is_private:
        return "private"
    return "other"


def is_direct_loopback(remote_ip: str | None) -> bool:
    """Return True when ``remote_ip`` is a direct loopback address."""
    return classify_remote_ip(remote_ip) == "loopback"
