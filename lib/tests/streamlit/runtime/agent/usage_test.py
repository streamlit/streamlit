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

"""The agent API counters and the page profile field they fill."""

from __future__ import annotations

import re
from typing import get_args

import pytest

from streamlit.proto.PageProfile_pb2 import PageProfile
from streamlit.runtime.agent import usage
from tests.streamlit.runtime.agent import usage_counts
from tests.testutil import patch_config_options


def test_record_counts_each_counter_and_reading_resets_nothing() -> None:
    """Each counter counts its own events, cumulatively, under one instance id."""
    with usage_counts.fresh(), patch_config_options(usage_counts.USAGE_STATS_ON):
        usage.record("http_interactions")
        usage.record("http_interactions")
        usage.record("mcp_interactions")
        first = PageProfile()
        usage.fill_page_profile(first)
        usage.record("sessions")
        second = PageProfile()
        usage.fill_page_profile(second)
        counts = usage_counts.reported()

    assert counts == {"http_interactions": 2, "mcp_interactions": 1, "sessions": 1}
    assert re.fullmatch(r"[0-9a-f]{32}", first.agent_api_usage.instance_id)
    assert second.agent_api_usage.instance_id == first.agent_api_usage.instance_id


def test_nothing_is_reported_before_the_first_count() -> None:
    """The page profile field stays unset while every count is zero."""
    with usage_counts.fresh():
        counts = usage_counts.reported()

    assert counts == {}


def test_nothing_is_counted_while_usage_stats_are_off() -> None:
    """Events during an opt-out are never reported, even after it ends."""
    with usage_counts.fresh():
        with patch_config_options({"browser.gatherUsageStats": False}):
            usage.record("http_interactions")
            usage.record_interaction("mcp")
            usage.record("sessions")
            during = usage_counts.reported()
            instance_id = usage._instance_id
        with patch_config_options(usage_counts.USAGE_STATS_ON):
            usage.record("http_interactions")
            after = usage_counts.reported()

    assert during == {}
    assert instance_id is None
    assert after == {"http_interactions": 1, "mcp_interactions": 0, "sessions": 0}


@pytest.mark.parametrize("transport", get_args(usage.Transport))
def test_record_interaction_counts_its_transport(transport: usage.Transport) -> None:
    """An interaction counts on its own transport's counter and no other."""
    with usage_counts.fresh(), patch_config_options(usage_counts.USAGE_STATS_ON):
        usage.record_interaction(transport)
        counts = usage_counts.reported()

    assert counts == {**usage_counts.NOTHING_COUNTED, f"{transport}_interactions": 1}
