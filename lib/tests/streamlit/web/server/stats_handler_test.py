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

from unittest.mock import MagicMock

import tornado.testing
import tornado.web
from google.protobuf.json_format import MessageToDict
from tornado.httputil import HTTPHeaders

from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
from streamlit.runtime.stats import CacheStat, CounterStat, GaugeStat
from streamlit.web.server.server import METRIC_ENDPOINT
from streamlit.web.server.stats_request_handler import StatsRequestHandler


class StatsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self.mock_stats: dict[str, list[CacheStat]] = {"cache_memory_bytes": []}
        mock_stats_manager = MagicMock()
        mock_stats_manager.get_stats = MagicMock(
            side_effect=lambda family_names=None: self.mock_stats
        )
        return tornado.web.Application(
            [
                (
                    rf"/{METRIC_ENDPOINT}",
                    StatsRequestHandler,
                    dict(stats_manager=mock_stats_manager),
                )
            ]
        )

    def test_no_stats(self):
        """If we have no stats, we expect to see just the EOF comment."""
        response = self.fetch("/_stcore/metrics")
        assert response.code == 200

        expected_body = b"# EOF\n"

        assert expected_body == response.body

    def test_deprecated_endpoint(self):
        response = self.fetch("/st-metrics")

        assert response.code == 200
        assert (
            response.headers["link"]
            == f'<http://127.0.0.1:{self.get_http_port()}/_stcore/metrics>; rel="alternate"'
        )
        assert response.headers["deprecation"] == "True"

    def test_has_stats(self):
        self.mock_stats = {
            "cache_memory_bytes": [
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
        }

        response = self.fetch("/_stcore/metrics")
        assert response.code == 200
        assert response.headers.get("Content-Type") == "application/openmetrics-text"

        expected_body = (
            b"# TYPE cache_memory_bytes gauge\n"
            b"# UNIT cache_memory_bytes bytes\n"
            b"# HELP Total memory consumed by a cache.\n"
            b'cache_memory_bytes{cache_type="st.singleton",cache="foo"} 128\n'
            b'cache_memory_bytes{cache_type="st.memo",cache="bar"} 256\n'
            b"# EOF\n"
        )

        assert expected_body == response.body

    def test_new_metrics_endpoint_should_not_display_deprecation_warning(self):
        response = self.fetch("/_stcore/metrics")
        assert "link" not in response.headers
        assert "deprecation" not in response.headers

    def test_protobuf_stats(self):
        """Stats requests are returned in OpenMetrics protobuf format
        if the request's Content-Type header is protobuf.
        """
        self.mock_stats = {
            "cache_memory_bytes": [
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
        }

        # Requests can have multiple Accept headers. Only one of them needs
        # to specify protobuf in order to get back protobuf.
        headers = HTTPHeaders()
        headers.add("Accept", "application/openmetrics-text")
        headers.add("Accept", "application/x-protobuf")
        headers.add("Accept", "text/html")

        response = self.fetch("/_stcore/metrics", headers=headers)
        assert response.code == 200
        assert response.headers.get("Content-Type") == "application/x-protobuf"

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

        assert expected == MessageToDict(metric_set)

    def test_protobuf_stats_uses_canonical_family_name_for_unitful_counter(self):
        """Unitful counters should use the canonical family name in protobuf."""
        self.mock_stats = {
            "session_duration_seconds": [
                CounterStat(
                    family_name="session_duration_seconds",
                    sample_name="session_duration_seconds_total",
                    value=42,
                    unit="seconds",
                    help="Total time spent in active sessions, in seconds.",
                )
            ]
        }

        response = self.fetch(
            "/_stcore/metrics",
            headers=HTTPHeaders({"Accept": "application/x-protobuf"}),
        )
        assert response.code == 200

        metric_set = MetricSetProto()
        metric_set.ParseFromString(response.body)

        expected = {
            "metricFamilies": [
                {
                    "name": "session_duration_seconds",
                    "type": "COUNTER",
                    "unit": "seconds",
                    "help": "Total time spent in active sessions, in seconds.",
                    "metrics": [
                        {"metricPoints": [{"counterValue": {"intValue": "42"}}]}
                    ],
                }
            ]
        }

        assert expected == MessageToDict(metric_set)


class StatsHandlerFilterTest(tornado.testing.AsyncHTTPTestCase):
    """Tests for filtering metrics by family name."""

    def get_app(self):
        self.mock_stats: dict[str, list] = {
            "cache_memory_bytes": [
                CacheStat(
                    category_name="st.memo",
                    cache_name="foo",
                    byte_length=128,
                )
            ],
            "session_events_total": [
                CounterStat(
                    family_name="session_events_total",
                    value=5,
                    labels={"type": "connect"},
                    help="Total count of session events by type.",
                ),
            ],
            "session_duration_seconds": [
                CounterStat(
                    family_name="session_duration_seconds",
                    sample_name="session_duration_seconds_total",
                    value=7,
                    unit="seconds",
                    help="Total time spent in active sessions, in seconds.",
                ),
            ],
            "active_sessions": [
                GaugeStat(
                    family_name="active_sessions",
                    value=3,
                    help="Current number of active sessions.",
                ),
            ],
        }

        def get_stats_side_effect(family_names=None):
            if family_names is None:
                return self.mock_stats
            return {k: self.mock_stats.get(k, []) for k in family_names}

        mock_stats_manager = MagicMock()
        mock_stats_manager.get_stats = MagicMock(side_effect=get_stats_side_effect)
        return tornado.web.Application(
            [
                (
                    rf"/{METRIC_ENDPOINT}",
                    StatsRequestHandler,
                    dict(stats_manager=mock_stats_manager),
                )
            ]
        )

    def test_no_filter_returns_all(self):
        """Without filter, all metric families should be returned."""
        response = self.fetch("/_stcore/metrics")
        assert response.code == 200

        body = response.body.decode()
        assert "cache_memory_bytes" in body
        assert "session_events_total" in body
        assert "active_sessions" in body

    def test_filter_single_family(self):
        """Filter should return only the requested family."""
        response = self.fetch("/_stcore/metrics?families=session_events_total")
        assert response.code == 200

        body = response.body.decode()
        assert "session_events_total" in body
        assert "cache_memory_bytes" not in body
        # Use TYPE declaration to avoid false matches in help text
        assert "# TYPE active_sessions" not in body

    def test_filter_multiple_families(self):
        """Filter should support multiple family names."""
        response = self.fetch(
            "/_stcore/metrics?families=session_events_total&families=active_sessions"
        )
        assert response.code == 200

        body = response.body.decode()
        assert "session_events_total" in body
        assert "active_sessions" in body
        assert "cache_memory_bytes" not in body

    def test_counter_stat_format(self):
        """CounterStat should be formatted correctly in text output."""
        response = self.fetch("/_stcore/metrics?families=session_events_total")
        assert response.code == 200

        body = response.body.decode()
        assert "# TYPE session_events_total counter" in body
        assert 'session_events_total{type="connect"} 5' in body

    def test_unitful_counter_stat_format(self):
        """Unitful counters should use canonical family metadata and sample names."""
        response = self.fetch("/_stcore/metrics?families=session_duration_seconds")
        assert response.code == 200

        body = response.body.decode()
        assert "# TYPE session_duration_seconds counter" in body
        assert "# UNIT session_duration_seconds seconds" in body
        assert "session_duration_seconds_total 7" in body

    def test_gauge_stat_format(self):
        """GaugeStat without labels should be formatted correctly."""
        response = self.fetch("/_stcore/metrics?families=active_sessions")
        assert response.code == 200

        body = response.body.decode()
        assert "# TYPE active_sessions gauge" in body
        assert "active_sessions 3" in body
