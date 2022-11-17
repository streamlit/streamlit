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

from unittest.mock import MagicMock

import tornado.testing
import tornado.web
from google.protobuf.json_format import MessageToDict
from tornado.httputil import HTTPHeaders

from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
from streamlit.runtime.stats import CacheStat
from streamlit.web.server.stats_request_handler import StatsRequestHandler


class StatsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self.mock_stats = []
        mock_stats_manager = MagicMock()
        mock_stats_manager.get_stats = MagicMock(side_effect=lambda: self.mock_stats)
        return tornado.web.Application(
            [
                (
                    r"/st-metrics",
                    StatsRequestHandler,
                    dict(stats_manager=mock_stats_manager),
                )
            ]
        )

    def test_no_stats(self):
        """If we have no stats, we expect to see just the header and footer."""
        response = self.fetch("/st-metrics")
        self.assertEqual(200, response.code)

        expected_body = (
            b"# TYPE cache_memory_bytes gauge\n"
            b"# UNIT cache_memory_bytes bytes\n"
            b"# HELP Total memory consumed by a cache.\n"
            b"# EOF\n"
        )

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

        response = self.fetch("/st-metrics")
        self.assertEqual(200, response.code)
        self.assertEqual(
            "application/openmetrics-text", response.headers.get("Content-Type")
        )

        expected_body = (
            b"# TYPE cache_memory_bytes gauge\n"
            b"# UNIT cache_memory_bytes bytes\n"
            b"# HELP Total memory consumed by a cache.\n"
            b'cache_memory_bytes{cache_type="st.singleton",cache="foo"} 128\n'
            b'cache_memory_bytes{cache_type="st.memo",cache="bar"} 256\n'
            b"# EOF\n"
        )

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

        # Requests can have multiple Accept headers. Only one of them needs
        # to specify protobuf in order to get back protobuf.
        headers = HTTPHeaders()
        headers.add("Accept", "application/openmetrics-text")
        headers.add("Accept", "application/x-protobuf")
        headers.add("Accept", "text/html")

        response = self.fetch("/st-metrics", headers=headers)
        self.assertEqual(200, response.code)
        self.assertEqual("application/x-protobuf", response.headers.get("Content-Type"))

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
