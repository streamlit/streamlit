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

"""HTTP client for Streamlit's loopback agent JSON endpoint."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urljoin

INTERACT_PATH = "/_stcore/agent/v1/interact"


class AgentClientError(Exception):
    """The agent endpoint was unreachable or rejected the request."""


def interact_url(app_or_interact_url: str) -> str:
    """Accept either the app origin or a full interact URL."""
    raw = app_or_interact_url.strip()
    if not raw:
        raise AgentClientError("App URL is empty.")
    if not raw.startswith(("http://", "https://")):
        raw = "http://" + raw
    if raw.rstrip("/").endswith(INTERACT_PATH):
        return raw.rstrip("/")
    origin = raw if raw.endswith("/") else raw + "/"
    return urljoin(origin, INTERACT_PATH.lstrip("/"))


class AgentClient:
    def __init__(self, app_or_interact_url: str) -> None:
        self.url = interact_url(app_or_interact_url)

    def interact(self, body: dict[str, Any] | None = None) -> dict[str, Any]:
        request = urllib.request.Request(
            self.url,
            data=json.dumps(body or {}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise AgentClientError(
                f"Agent endpoint returned HTTP {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise AgentClientError(f"Could not reach {self.url}: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise AgentClientError("Agent endpoint returned non-JSON.") from exc
        if not isinstance(payload, dict):
            raise AgentClientError("Agent endpoint returned a non-object JSON value.")
        return payload
