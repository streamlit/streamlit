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

import unittest
from typing import TYPE_CHECKING

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
    CACHE_MEMORY_FAMILY,
    CacheStat,
    CounterStat,
    GaugeStat,
    StatsManager,
    StatsProvider,
    group_cache_stats,
    metric_type_string_to_proto,
)

if TYPE_CHECKING:
    from collections.abc import Sequence


class MockStatsProvider(StatsProvider):
    """A mock provider that can return stats for one or multiple families."""

    def __init__(self, supported_families: list[str]) -> None:
        self._supported_families = supported_families
        self.stats_by_family: dict[str, list[CacheStat]] = {}

    @property
    def stats_families(self) -> Sequence[str]:
        return self._supported_families

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        result: dict[str, list[CacheStat]] = {}
        for family in self._supported_families:
            # Skip if this family isn't requested
            if family_names is not None and family not in family_names:
                continue
            if self.stats_by_family.get(family):
                result[family] = self.stats_by_family[family]
        return result


class StatsManagerTest(unittest.TestCase):
    def test_get_stats(self) -> None:
        """StatsManager.get_stats should return all providers' stats grouped by family."""
        manager = StatsManager()
        provider1 = MockStatsProvider([CACHE_MEMORY_FAMILY])
        provider2 = MockStatsProvider([CACHE_MEMORY_FAMILY])
        manager.register_provider(provider1)
        manager.register_provider(provider2)

        # No stats
        assert manager.get_stats() == {}

        # Some stats
        provider1.stats_by_family[CACHE_MEMORY_FAMILY] = [
            CacheStat("provider1", "foo", 1),
            CacheStat("provider1", "bar", 2),
        ]

        provider2.stats_by_family[CACHE_MEMORY_FAMILY] = [
            CacheStat("provider2", "baz", 3),
            CacheStat("provider2", "qux", 4),
        ]

        result = manager.get_stats()
        assert CACHE_MEMORY_FAMILY in result
        expected_stats = (
            provider1.stats_by_family[CACHE_MEMORY_FAMILY]
            + provider2.stats_by_family[CACHE_MEMORY_FAMILY]
        )
        assert expected_stats == result[CACHE_MEMORY_FAMILY]

    def test_get_stats_multiple_families(self) -> None:
        """StatsManager should support multiple metric families."""
        manager = StatsManager()
        provider1 = MockStatsProvider(["family_a"])
        provider2 = MockStatsProvider(["family_b"])
        manager.register_provider(provider1)
        manager.register_provider(provider2)

        provider1.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider2.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]

        result = manager.get_stats()
        assert "family_a" in result
        assert "family_b" in result
        assert result["family_a"] == provider1.stats_by_family["family_a"]
        assert result["family_b"] == provider2.stats_by_family["family_b"]

    def test_only_queries_relevant_providers(self) -> None:
        """StatsManager should only call providers registered for requested families."""
        manager = StatsManager()
        provider_a = MockStatsProvider(["family_a"])
        provider_b = MockStatsProvider(["family_b"])
        manager.register_provider(provider_a)
        manager.register_provider(provider_b)

        provider_a.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider_b.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]

        # Request only family_a. provider_b should not be called
        result = manager.get_stats(family_names=["family_a"])
        assert "family_a" in result
        assert "family_b" not in result

    def test_provider_registered_for_multiple_families(self) -> None:
        """A provider can be registered for multiple families."""
        manager = StatsManager()
        provider = MockStatsProvider(["family_a", "family_b"])
        manager.register_provider(provider)

        provider.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]

        result = manager.get_stats()
        assert "family_a" in result
        assert result["family_a"] == provider.stats_by_family["family_a"]

    def test_filtering_excludes_unrequested_families_from_multi_family_provider(
        self,
    ) -> None:
        """When requesting one family, stats for other families should be excluded."""
        manager = StatsManager()
        provider = MockStatsProvider(["family_a", "family_b"])
        manager.register_provider(provider)

        provider.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]

        result = manager.get_stats(family_names=["family_a"])

        # Should only get family_a stats, not family_b
        assert "family_a" in result
        assert "family_b" not in result
        assert result["family_a"] == provider.stats_by_family["family_a"]

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

        assert stat.family_name == CACHE_MEMORY_FAMILY
        assert stat.type == "gauge"
        assert stat.unit == "bytes"
        assert stat.help == "Total memory consumed by a cache."

    def test_cache_stat_to_metric_str(self) -> None:
        """CacheStat.to_metric_str should use family_name."""
        stat = CacheStat("st.cache_data", "my_func", 512)
        expected = 'cache_memory_bytes{cache_type="st.cache_data",cache="my_func"} 512'
        assert stat.to_metric_str() == expected


class StatsManagerFilterTest(unittest.TestCase):
    def test_get_stats_with_family_filter(self) -> None:
        """StatsManager.get_stats should filter by family names when provided."""
        manager = StatsManager()
        provider1 = MockStatsProvider(["family_a"])
        provider2 = MockStatsProvider(["family_b"])
        manager.register_provider(provider1)
        manager.register_provider(provider2)

        provider1.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider2.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]

        result = manager.get_stats(family_names=["family_a"])
        assert "family_a" in result
        assert "family_b" not in result
        assert result["family_a"] == provider1.stats_by_family["family_a"]

    def test_get_stats_with_multiple_family_filter(self) -> None:
        """StatsManager.get_stats should support filtering by multiple families."""
        manager = StatsManager()
        provider1 = MockStatsProvider(["family_a"])
        provider2 = MockStatsProvider(["family_b"])
        provider3 = MockStatsProvider(["family_c"])
        manager.register_provider(provider1)
        manager.register_provider(provider2)
        manager.register_provider(provider3)

        provider1.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider2.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]
        provider3.stats_by_family["family_c"] = [CacheStat("family_c", "cache3", 300)]

        result = manager.get_stats(family_names=["family_a", "family_c"])
        assert "family_a" in result
        assert "family_b" not in result
        assert "family_c" in result
        assert result["family_a"] == provider1.stats_by_family["family_a"]
        assert result["family_c"] == provider3.stats_by_family["family_c"]

    def test_get_stats_with_unknown_family(self) -> None:
        """StatsManager.get_stats should return empty result for unknown families."""
        manager = StatsManager()
        provider = MockStatsProvider(["family_a"])
        manager.register_provider(provider)
        provider.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]

        result = manager.get_stats(family_names=["unknown_family"])
        assert "unknown_family" not in result
        assert result == {}

    def test_get_stats_no_filter_returns_all(self) -> None:
        """StatsManager.get_stats with no filter should return all families."""
        manager = StatsManager()
        provider1 = MockStatsProvider(["family_a"])
        provider2 = MockStatsProvider(["family_b"])
        manager.register_provider(provider1)
        manager.register_provider(provider2)

        provider1.stats_by_family["family_a"] = [CacheStat("family_a", "cache1", 100)]
        provider2.stats_by_family["family_b"] = [CacheStat("family_b", "cache2", 200)]

        result = manager.get_stats(family_names=None)
        assert "family_a" in result
        assert "family_b" in result


class CounterStatTest(unittest.TestCase):
    def test_counter_stat_implements_stat_protocol(self) -> None:
        """CounterStat should have all the properties required by the Stat protocol."""
        stat = CounterStat(
            family_name="test_counter",
            value=42,
            labels={"type": "test"},
            unit="",
            help="A test counter.",
        )

        assert stat.family_name == "test_counter"
        assert stat.type == "counter"
        assert stat.unit == ""
        assert stat.help == "A test counter."
        assert stat.value == 42
        assert stat.labels == {"type": "test"}

    def test_counter_stat_to_metric_str(self) -> None:
        """CounterStat.to_metric_str should format correctly."""
        stat = CounterStat(
            family_name="session_events",
            value=10,
            labels={"type": "connection"},
        )
        expected = 'session_events_total{type="connection"} 10'
        assert stat.to_metric_str() == expected

    def test_counter_stat_to_metric_str_multiple_labels(self) -> None:
        """CounterStat.to_metric_str should handle multiple labels sorted."""
        stat = CounterStat(
            family_name="my_counter",
            value=5,
            labels={"z_label": "z_val", "a_label": "a_val"},
        )
        expected = 'my_counter_total{a_label="a_val",z_label="z_val"} 5'
        assert stat.to_metric_str() == expected

    def test_counter_stat_to_metric_str_with_unit_suffix_family_name(self) -> None:
        """CounterStat.to_metric_str should append _total to counter family names."""
        stat = CounterStat(
            family_name="session_duration_seconds",
            value=42,
            unit="seconds",
        )
        expected = "session_duration_seconds_total 42"
        assert stat.to_metric_str() == expected

    def test_counter_stat_to_metric_str_with_labels(self) -> None:
        """CounterStat.to_metric_str should append _total for labeled counters."""
        stat = CounterStat(
            family_name="session_duration_seconds",
            value=42,
            labels={"region": "us-west"},
            unit="seconds",
        )
        expected = 'session_duration_seconds_total{region="us-west"} 42'
        assert stat.to_metric_str() == expected

    def test_counter_stat_to_metric_str_no_labels(self) -> None:
        """CounterStat.to_metric_str should format correctly without labels."""
        stat = CounterStat(
            family_name="simple_counter",
            value=7,
        )
        expected = "simple_counter_total 7"
        assert stat.to_metric_str() == expected


class GaugeStatTest(unittest.TestCase):
    def test_gauge_stat_implements_stat_protocol(self) -> None:
        """GaugeStat should have all the properties required by the Stat protocol."""
        stat = GaugeStat(
            family_name="active_sessions",
            value=3,
            unit="",
            help="Current number of active sessions.",
        )

        assert stat.family_name == "active_sessions"
        assert stat.type == "gauge"
        assert stat.unit == ""
        assert stat.help == "Current number of active sessions."
        assert stat.value == 3

    def test_gauge_stat_to_metric_str(self) -> None:
        """GaugeStat.to_metric_str should format correctly without labels."""
        stat = GaugeStat(
            family_name="active_sessions",
            value=5,
        )
        expected = "active_sessions 5"
        assert stat.to_metric_str() == expected

    def test_gauge_stat_to_metric_str_with_labels(self) -> None:
        """GaugeStat.to_metric_str should format correctly with labels."""
        stat = GaugeStat(
            family_name="active_sessions",
            value=5,
            labels={"region": "us-west"},
        )
        expected = 'active_sessions{region="us-west"} 5'
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
