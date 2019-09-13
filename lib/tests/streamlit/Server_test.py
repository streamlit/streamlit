# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Server.py unit tests"""

import unittest

import mock
import tornado.testing
import tornado.web
import tornado.websocket
from mock import patch
from tornado import gen

from streamlit import config
from streamlit.server.Server import State
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.server_util import is_url_from_allowed_origins
from tests.ServerTestCase import ServerTestCase


# Stub out the Server's ReportSession import. We don't want
# actual sessions to be instantiated, or scripts to be run.
# Test methods must take an additional parameter (mock.patch
# will pass the mocked stub to each test function.)
@mock.patch("streamlit.server.Server.ReportSession", autospec=True)
class ServerTest(ServerTestCase):
    @tornado.testing.gen_test
    def test_start_stop(self, _):
        """Test that we can start and stop the server."""
        yield self.start_server_loop()
        self.assertEqual(State.WAITING_FOR_FIRST_BROWSER, self.server._state)

        self.server.stop()
        self.assertEqual(State.STOPPING, self.server._state)

        yield gen.sleep(0.1)
        self.assertEqual(State.STOPPED, self.server._state)

    @tornado.testing.gen_test
    def test_websocket_connect(self, _):
        """Test that we can connect to the server via websocket."""
        yield self.start_server_loop()

        self.assertFalse(self.server.browser_is_connected)

        # Open a websocket connection
        ws_client = yield self.ws_connect()
        self.assertTrue(self.server.browser_is_connected)

        # Close the connection, give the server a moment to step
        # its runloop, and assert we're no longer connected.
        ws_client.close()
        yield gen.sleep(0.1)
        self.assertFalse(self.server.browser_is_connected)


class ServerUtilsTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        self.assertTrue(is_url_from_allowed_origins("localhost"))
        self.assertTrue(is_url_from_allowed_origins("127.0.0.1"))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch(
            "streamlit.server.server_util.config.get_option", side_effect=[False]
        ):
            self.assertTrue(is_url_from_allowed_origins("does not matter"))

    def test_is_url_from_allowed_origins_s3_bucket(self):
        with patch(
            "streamlit.server.server_util.config.get_option",
            side_effect=[True, "mybucket"],
        ):
            self.assertTrue(is_url_from_allowed_origins("mybucket"))

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with patch(
            "streamlit.server.server_util.config.is_manually_set", side_effect=[True]
        ), patch(
            "streamlit.server.server_util.config.get_option",
            side_effect=[True, "browser.server.address"],
        ):
            self.assertTrue(is_url_from_allowed_origins("browser.server.address"))

    def test_is_url_from_allowed_origins_s3_url(self):
        with patch(
            "streamlit.server.server_util.config.is_manually_set", side_effect=[True]
        ), patch(
            "streamlit.server.server_util.config.get_option",
            side_effect=[True, "s3.amazon.com"],
        ):
            self.assertTrue(is_url_from_allowed_origins("s3.amazon.com"))


class HealthHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /healthz endpoint"""

    def setUp(self):
        super(HealthHandlerTest, self).setUp()
        self._is_healthy = True

    def is_healthy(self):
        return self._is_healthy

    def get_app(self):
        return tornado.web.Application(
            [(r"/healthz", HealthHandler, dict(health_check=self.is_healthy))]
        )

    def test_healthz(self):
        response = self.fetch("/healthz")
        self.assertEqual(200, response.code)
        self.assertEqual(b"ok", response.body)

        self._is_healthy = False
        response = self.fetch("/healthz")
        self.assertEqual(503, response.code)


class MetricsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /metrics endpoint"""

    def get_app(self):
        return tornado.web.Application([(r"/metrics", MetricsHandler)])

    def test_metrics(self):
        config.set_option("global.metrics", False)
        response = self.fetch("/metrics")
        self.assertEqual(404, response.code)

        config.set_option("global.metrics", True)
        response = self.fetch("/metrics")
        self.assertEqual(200, response.code)


class DebugHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /debugz endpoint"""

    def get_app(self):
        return tornado.web.Application([(r"/debugz", DebugHandler)])

    def test_debug(self):
        # TODO - debugz is currently broken
        pass
