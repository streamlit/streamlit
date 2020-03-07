# Copyright 2018-2020 Streamlit Inc.
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

"""Metrics Module Unittest."""
import unittest

import pytest

import streamlit.metrics

from mock import call, patch

from streamlit import config


class MetricsTest(unittest.TestCase):
    """Metrics Unittest class."""

    def setUp(self):
        """Make sure Client singleton is always empty before starting tests."""
        streamlit.metrics.Client._singleton = None

    def tearDown(self):
        """Cleanup metrics client."""
        config.set_option("global.metrics", False)
        streamlit.metrics.Client._singleton = None
        client = streamlit.metrics.Client.get_current()
        client.toggle_metrics()

    def test_constructor(self):
        """Test streamlit.metrics.Client."""
        client = streamlit.metrics.Client()
        self.assertEqual(streamlit.metrics.Client._singleton, client)

    def test_get_current(self):
        """Test streamlit.metrics.clientget_current."""
        client = streamlit.metrics.Client.get_current()
        self.assertEqual(streamlit.metrics.Client._singleton, client)

    def test_not_singleton(self):
        """Test streamlit.metrics.Client not singleton."""
        client = streamlit.metrics.Client.get_current()

        with pytest.raises(RuntimeError) as e:
            streamlit.metrics.Client()
        msg = "Client already initialized. Use .get_current() instead"
        self.assertEqual(msg, str(e.value))

    def test_enabled_metrics_no_prometheus(self):
        """Test streamlit.metrics.Client.toggle_metrics no prometheus."""
        config.set_option("global.metrics", True)

        client = streamlit.metrics.Client.get_current()
        builtin_import = "builtins.__import__"

        with pytest.raises(ImportError) as e:
            with patch(builtin_import, side_effect=ImportError):
                client.toggle_metrics()
        msg = "prometheus-client is not installed. pip install prometheus-client"
        self.assertEqual(msg, str(e.value))

    def test_enabled_metrics(self):
        """Test streamlit.metrics.toggle_metrics enabled."""
        config.set_option("global.metrics", True)
        client = streamlit.metrics.Client.get_current()
        client._metrics = {}

        # yapf: disable
        client._raw_metrics = [
            ('Counter', 'unittest_counter', 'Unittest counter', []),
            ('Counter', 'unittest_counter_labels', 'Unittest counter labels', ['label']),
            ('Gauge', 'unittest_gauge', 'Unittest gauge', []),
        ]
        # yapf: enable

        client.toggle_metrics()

        client.get("unittest_counter").inc()
        client.get("unittest_counter_labels").labels("some_label")
        client.get("unittest_gauge").set(42)

        truth = [
            "unittest_counter_total 1.0",
            'unittest_counter_labels_total{label="some_label"} 0.0',
            "unittest_gauge 42.0",
        ]
        lines = client.generate_latest().splitlines()
        metrics = [
            x.decode("utf-8") for x in lines if x.decode("utf-8").startswith("unit")
        ]
        metrics = [str(x) for x in metrics if "_created" not in x]
        self.assertEqual(sorted(truth), sorted(metrics))

    def test_disabled_metrics_check_value(self):
        """Test streamlit.metrics.Client.toggle_metrics disabled check value."""
        with patch("streamlit.metrics.MockMetric", spec=True) as mock_metric:
            config.set_option("global.metrics", False)
            client = streamlit.metrics.Client.get_current()
            client._metrics = {}

            # yapf: disable
            client._raw_metrics = [
                ('Counter', 'unittest_counter', 'Unittest counter', []),
                ('Counter', 'unittest_counter_labels', 'Unittest counter labels', ['label']),
                ('Gauge', 'unittest_gauge', 'Unittest gauge', []),
            ]
            # yapf: enable

            client.toggle_metrics()

            # Test that handler in Server.py will return nothing.
            self.assertEqual(client.generate_latest(), "")

            client.get("unittest_counter").inc()
            client.get("unittest_counter_labels").labels("some_label")
            client.get("unittest_gauge").set(42)
            client.get("unittest_gauge").dec()

            calls = [
                call(),  # Constructor
                call(),  # unittest_counter
                call(),  # unittest_counter_labels
                call(),  # unittest_gauge
                call().inc(),
                call().labels("some_label"),
                call().set(42),
                call().dec(),
            ]
            self.assertEqual(calls, mock_metric.mock_calls)

    def test_disabled_metrics(self):
        """Test streamlit.metrics.Client.toggle_metrics disabled."""
        config.set_option("global.metrics", False)
        client = streamlit.metrics.Client.get_current()
        client._metrics = {}

        # yapf: disable
        client._raw_metrics = [
            ('Counter', 'unittest_counter', 'Unittest counter', []),
            ('Counter', 'unittest_counter_labels', 'Unittest counter labels', ['label']),
            ('Gauge', 'unittest_gauge', 'Unittest gauge', []),
        ]
        # yapf: enable

        client.toggle_metrics()

        client.get("unittest_counter").inc()
        client.get("unittest_counter_labels").labels("some_label")
        client.get("unittest_gauge").set(42)
        client.get("unittest_gauge").dec()

        # Purposely not testing anything, just verifying the calls
        # actually work.
