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

"""Fresh agent API counters for a test, and what they would report.

The counters are process-wide, so a test that counts zeroes them first and
restores them after. The test config turns `browser.gatherUsageStats` off, so
such a test also turns it on with `USAGE_STATS_ON`.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Final, get_args
from unittest.mock import patch

from streamlit.proto.PageProfile_pb2 import PageProfile
from streamlit.runtime.agent import usage

if TYPE_CHECKING:
    from collections.abc import Generator

USAGE_STATS_ON: Final[dict[str, Any]] = {"browser.gatherUsageStats": True}
NOTHING_COUNTED: Final[dict[str, int]] = dict.fromkeys(get_args(usage.UsageCounter), 0)


@contextmanager
def fresh() -> Generator[None, None, None]:
    """Zero the process's agent API counters, and forget its instance id."""
    with (
        patch.object(usage, "_counts", dict.fromkeys(usage._counts, 0)),
        patch.object(usage, "_instance_id", None),
    ):
        yield


def reported() -> dict[str, int]:
    """The counts a page profile would carry now, or ``{}`` if it would carry none."""
    profile = PageProfile()
    usage.fill_page_profile(profile)
    if not profile.HasField("agent_api_usage"):
        return {}
    return {
        name: getattr(profile.agent_api_usage, name)
        for name in get_args(usage.UsageCounter)
    }
