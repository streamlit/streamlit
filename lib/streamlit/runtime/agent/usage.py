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

"""Count agent API activity in this server process for the page profile.

Browsers are the only telemetry sender, so the counts ride on the page profile
each browser session reports after a run. They are cumulative, so every later
report repeats them, and they carry a random id of the process. Analysis takes
each process's largest count and adds those up across restarts and replicas,
which counts nothing twice.
"""

from __future__ import annotations

import threading
import uuid
from typing import TYPE_CHECKING, Final, Literal, TypeAlias, get_args

from streamlit import config

if TYPE_CHECKING:
    from streamlit.proto.PageProfile_pb2 import PageProfile

Transport: TypeAlias = Literal["http", "mcp"]
UsageCounter: TypeAlias = Literal["http_interactions", "mcp_interactions", "sessions"]

_INTERACTION_COUNTERS: Final[dict[Transport, UsageCounter]] = {
    "http": "http_interactions",
    "mcp": "mcp_interactions",
}

# Guards `_counts` and `_instance_id`: `record` runs on the event loop, and
# `fill_page_profile` on script threads.
_lock: Final = threading.Lock()
_counts: Final[dict[UsageCounter, int]] = dict.fromkeys(get_args(UsageCounter), 0)
# Created on the first count rather than at import, so a server that forks its
# workers after importing Streamlit, such as `gunicorn --preload`, gives each
# worker its own.
_instance_id: str | None = None


def record(counter: UsageCounter) -> None:
    """Increment ``counter`` by one, unless usage stats are off."""
    global _instance_id  # noqa: PLW0603
    # Read on every call, since `config.toml` can be reloaded while the server
    # runs: anything counted during an opt-out would be reported once usage
    # stats are back on.
    if not config.get_option("browser.gatherUsageStats"):
        return
    with _lock:
        if _instance_id is None:
            _instance_id = uuid.uuid4().hex
        _counts[counter] += 1


def record_interaction(transport: Transport) -> None:
    """Count one agent request on the counter for the route it arrived on."""
    record(_INTERACTION_COUNTERS[transport])


def fill_page_profile(page_profile: PageProfile) -> None:
    """Copy the counts onto ``page_profile``, unless every count is zero.

    The field stays unset at zero, so the page profile of an app that never
    received an agent request does not change.
    """
    with _lock:
        counts = dict(_counts)
        instance_id = _instance_id
    if instance_id is None or not any(counts.values()):
        return
    page_profile.agent_api_usage.instance_id = instance_id
    for name, value in counts.items():
        setattr(page_profile.agent_api_usage, name, value)
