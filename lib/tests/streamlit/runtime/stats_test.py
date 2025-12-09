# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import unittest

from parameterized import parameterized

from streamlit.proto.openmetrics_data_model_pb2 import (
    COUNTER,
    GAUGE,
    GAUGE_HISTOGRAM,
    HISTOGRAM,
    INFO,
    STATE_SET,
    SUMMARY,
    UNKNOWN,
)
from streamlit.runtime.stats import (
    CacheStat,
    StatsManager,
    StatsProvider,
    group_cache_stats,
    metric_type_string_to_proto,
)


class MockStatsProvider(StatsProvider):
    def __init__(self) -> None:
        self.stats: list[CacheStat] = []

    def get_stats(self) -> list[CacheStat]:
        return self.stats


class StatsManagerTest(unittest.TestCase):
    def test_get_stats(self) -> None:
        """StatsManager.get_stats should return all providers' stats grouped by family."""
        manager = StatsManager()
        provider1 = MockStatsProvider()
        provider2 = MockStatsProvider()
        manager.register_provider("cache_memory_bytes", provider1)
        manager.register_provider("cache_memory_bytes", provider2)

        # No stats
        assert manager.get_stats() == {"cache_memory_bytes": []}

        # Some stats
        provider1.stats = [
            CacheStat("provider1", "foo", 1),
            CacheStat("provider1", "bar", 2),
        ]

        provider2.stats = [
            CacheStat("provider2", "baz", 3),
            CacheStat("provider2", "qux", 4),
        ]

        result = manager.get_stats()
        assert "cache_memory_bytes" in result
        assert provider1.stats + provider2.stats == result["cache_memory_bytes"]

    def test_get_stats_multiple_families(self) -> None:
        """StatsManager should support multiple metric families."""
        manager = StatsManager()
        provider1 = MockStatsProvider()
        provider2 = MockStatsProvider()
        manager.register_provider("family_a", provider1)
        manager.register_provider("family_b", provider2)

        provider1.stats = [CacheStat("family_a", "cache1", 100)]
        provider2.stats = [CacheStat("family_b", "cache2", 200)]

        result = manager.get_stats()
        assert "family_a" in result
        assert "family_b" in result
        assert result["family_a"] == provider1.stats
        assert result["family_b"] == provider2.stats

    def test_group_cache_stats(self) -> None:
        """Should return stats grouped by category_name and cache_name.

        byte_length should be summed.
        """
        # Similar stats sequential
        stats1 = [
            CacheStat("provider1", "foo", 1),
            CacheStat("provider1", "bar", 2),
            CacheStat("provider1", "bar", 5),
        ]

        # Similar stats not sequential
        stats2 = [
            CacheStat("provider2", "baz", 3),
            CacheStat("provider2", "qux", 4),
            CacheStat("provider2", "baz", 28),
        ]

        # All the same stats
        stats3 = [
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
            CacheStat("provider3", "boo", 1),
        ]

        assert set(group_cache_stats(stats1)) == {
            CacheStat("provider1", "foo", 1),
            CacheStat("provider1", "bar", 7),
        }

        assert set(group_cache_stats(stats2)) == {
            CacheStat("provider2", "baz", 31),
            CacheStat("provider2", "qux", 4),
        }

        assert set(group_cache_stats(stats3)) == {CacheStat("provider3", "boo", 7)}


class CacheStatProtocolTest(unittest.TestCase):
    def test_cache_stat_implements_stat_protocol(self) -> None:
        """CacheStat should have all the properties required by the Stat protocol."""
        stat = CacheStat("test_category", "test_cache", 1024)

        assert stat.family_name == "cache_memory_bytes"
        assert stat.type == "gauge"
        assert stat.unit == "bytes"
        assert stat.help == "Total memory consumed by a cache."

    def test_cache_stat_to_metric_str(self) -> None:
        """CacheStat.to_metric_str should use family_name."""
        stat = CacheStat("st.cache_data", "my_func", 512)
        expected = 'cache_memory_bytes{cache_type="st.cache_data",cache="my_func"} 512'
        assert stat.to_metric_str() == expected


class MetricTypeStringToProtoTest(unittest.TestCase):
    @parameterized.expand(
        [
            ("gauge", GAUGE),
            ("counter", COUNTER),
            ("state_set", STATE_SET),
            ("info", INFO),
            ("histogram", HISTOGRAM),
            ("gauge_histogram", GAUGE_HISTOGRAM),
            ("summary", SUMMARY),
        ]
    )
    def test_known_types(self, type_string: str, expected: int) -> None:
        """Test that known metric type strings map to correct proto enum values."""
        assert metric_type_string_to_proto(type_string) == expected

    def test_unknown_type_returns_unknown(self) -> None:
        """Test that unknown type strings return the UNKNOWN enum value."""
        assert metric_type_string_to_proto("not_a_real_type") == UNKNOWN
        assert metric_type_string_to_proto("") == UNKNOWN
