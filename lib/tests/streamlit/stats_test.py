# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest
from typing import List
from unittest.mock import MagicMock

import tornado.testing
import tornado.web
from google.protobuf.json_format import MessageToDict

from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
from streamlit.stats import StatsHandler, CacheStat, CacheStatsProvider, StatsManager


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


class StatsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self.mock_stats = []
        mock_stats_manager = MagicMock()
        mock_stats_manager.get_stats = MagicMock(side_effect=lambda: self.mock_stats)
        return tornado.web.Application(
            [(r"/metrics", StatsHandler, dict(stats_manager=mock_stats_manager))]
        )

    def test_no_stats(self):
        """If we have no stats, we expect to see just the header and footer."""
        response = self.fetch("/metrics")
        self.assertEqual(200, response.code)

        expected_body = (
            "# TYPE cache_memory_bytes gauge\n"
            "# UNIT cache_memory_bytes bytes\n"
            "# HELP Total memory consumed by a cache.\n"
            "# EOF\n"
        ).encode("utf-8")

        self.assertEqual(expected_body, response.body)

    def test_has_stats(self):
        self.mock_stats = [
            CacheStat(
                category_name="st.singleton",
                cache_name="foo",
                byte_length=128,
            ),
            CacheStat(
                category_name="st.memo",
                cache_name="bar",
                byte_length=256,
            ),
        ]

        response = self.fetch("/metrics")
        self.assertEqual(200, response.code)

        expected_body = (
            "# TYPE cache_memory_bytes gauge\n"
            "# UNIT cache_memory_bytes bytes\n"
            "# HELP Total memory consumed by a cache.\n"
            'cache_memory_bytes{cache_type="st.singleton",cache="foo"} 128\n'
            'cache_memory_bytes{cache_type="st.memo",cache="bar"} 256\n'
            "# EOF\n"
        ).encode("utf-8")

        self.assertEqual(expected_body, response.body)

    def test_protobuf_stats(self):
        """Stats requests are returned in OpenMetrics protobuf format
        if the request's Content-Type header is protobuf.
        """
        self.mock_stats = [
            CacheStat(
                category_name="st.singleton",
                cache_name="foo",
                byte_length=128,
            ),
            CacheStat(
                category_name="st.memo",
                cache_name="bar",
                byte_length=256,
            ),
        ]

        response = self.fetch(
            "/metrics", headers={"Content-Type": "application/x-protobuf"}
        )
        self.assertEqual(200, response.code)

        metric_set = MetricSetProto()
        metric_set.ParseFromString(response.body)

        expected = {
            "metricFamilies": [
                {
                    "name": "cache_memory_bytes",
                    "type": "GAUGE",
                    "unit": "bytes",
                    "help": "Total memory consumed by a cache.",
                    "metrics": [
                        {
                            "labels": [
                                {"name": "cache_type", "value": "st.singleton"},
                                {"name": "cache", "value": "foo"},
                            ],
                            "metricPoints": [{"gaugeValue": {"intValue": "128"}}],
                        },
                        {
                            "labels": [
                                {"name": "cache_type", "value": "st.memo"},
                                {"name": "cache", "value": "bar"},
                            ],
                            "metricPoints": [{"gaugeValue": {"intValue": "256"}}],
                        },
                    ],
                }
            ]
        }

        self.assertEqual(expected, MessageToDict(metric_set))
