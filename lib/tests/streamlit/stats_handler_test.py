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

from unittest.mock import MagicMock

import tornado.testing
import tornado.web

from streamlit.stats import StatsHandler, CacheStat


class StatsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self.mock_stats = []
        mock_stats_manager = MagicMock()
        mock_stats_manager.get_stats = MagicMock(side_effect=lambda: self.mock_stats)
        return tornado.web.Application(
            [(r"/statz", StatsHandler, dict(stats_manager=mock_stats_manager))]
        )

    def test_no_stats(self):
        """If we have no stats, we expect to see just the header and footer."""
        response = self.fetch("/statz")
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

        response = self.fetch("/statz")
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
