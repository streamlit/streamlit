# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import unittest
from typing import List

from streamlit.runtime.stats import CacheStat, CacheStatsProvider, StatsManager


class MockStatsProvider(CacheStatsProvider):
    def __init__(self):
        self.stats: List[CacheStat] = []

    def get_stats(self) -> List[CacheStat]:
        return self.stats


class StatsManagerTest(unittest.TestCase):
    def test_get_stats(self):
        """StatsManager.get_stats should return all providers' stats."""
        manager = StatsManager()
        provider1 = MockStatsProvider()
        provider2 = MockStatsProvider()
        manager.register_provider(provider1)
        manager.register_provider(provider2)

        # No stats
        self.assertEqual([], manager.get_stats())

        # Some stats
        provider1.stats = [
            CacheStat("provider1", "foo", 1),
            CacheStat("provider1", "bar", 2),
        ]

        provider2.stats = [
            CacheStat("provider2", "baz", 3),
            CacheStat("provider2", "qux", 4),
        ]

        self.assertEqual(provider1.stats + provider2.stats, manager.get_stats())
