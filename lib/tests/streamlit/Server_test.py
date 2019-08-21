# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""Server.py unit tests"""

import unittest

import mock
import requests
import tornado.testing
import tornado.web
import tornado.websocket
from mock import patch
from tornado import gen

from streamlit import config
from streamlit.server.Server import Server
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.server_util import is_url_from_allowed_origins


class ServerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        ioloop = self.get_new_ioloop()
        self._server = Server(ioloop, '/not/a/script.py', [])
        app = self._server._create_app()
        return app

    def get_ws_url(self, path):
        """Return a ws:// URL with the given path for our test server."""
        # get_url() gives us a result with the 'http' scheme;
        # we swap it out for 'ws'.
        url = self.get_url(path)
        parts = list(requests.utils.urlparse(url))
        parts[0] = 'ws'
        return requests.utils.urlunparse(tuple(parts))

    def ws_connect(self):
        """Open a websocket connection to the server.

        Returns
        -------
        A Future that resolves with the connected websocket client.
        You need to yield on this value from within a
        'tornado.testing.gen_test' coroutine.

        """
        return tornado.websocket.websocket_connect(self.get_ws_url('/stream'))

    @tornado.testing.gen_test
    def test_websocket_connect(self):
        """Test that we can connect to the server via websocket."""
        # Stub out the Server's ReportSession import. We don't want
        # actual sessions to be instantiated, or scripts to be run.
        with mock.patch('streamlit.server.Server.ReportSession', autospec=True):
            self.assertFalse(self._server.browser_is_connected)

            # Open a websocket connection
            ws_client = yield self.ws_connect()
            self.assertTrue(self._server.browser_is_connected)

            # Close the connection, give the server a moment to step
            # its runloop, and assert we're no longer connected.
            ws_client.close()
            yield gen.sleep(0.1)
            self.assertFalse(self._server.browser_is_connected)


class ServerUtilsTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        self.assertTrue(
            is_url_from_allowed_origins('localhost'))
        self.assertTrue(
            is_url_from_allowed_origins('127.0.0.1'))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch('streamlit.server.server_util.config.get_option',
                   side_effect=[False]):
            self.assertTrue(
                is_url_from_allowed_origins('does not matter'))

    def test_is_url_from_allowed_origins_s3_bucket(self):
        with patch('streamlit.server.server_util.config.get_option',
                   side_effect=[True, 'mybucket']):
            self.assertTrue(
                is_url_from_allowed_origins('mybucket'))

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with patch('streamlit.server.server_util.config.is_manually_set',
                   side_effect=[True]), \
                patch('streamlit.server.server_util.config.get_option',
                      side_effect=[True, 'browser.server.address']):
            self.assertTrue(is_url_from_allowed_origins(
                'browser.server.address'))

    def test_is_url_from_allowed_origins_s3_url(self):
        with patch('streamlit.server.server_util.config.is_manually_set',
                   side_effect=[True]), \
                patch('streamlit.server.server_util.config.get_option',
                      side_effect=[True, 's3.amazon.com']):
            self.assertTrue(
                is_url_from_allowed_origins('s3.amazon.com'))


class HealthHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /healthz endpoint"""
    def setUp(self):
        super(HealthHandlerTest, self).setUp()
        self._is_healthy = True

    def is_healthy(self):
        return self._is_healthy

    def get_app(self):
        return tornado.web.Application([
            (r'/healthz', HealthHandler, dict(health_check=self.is_healthy)),
        ])

    def test_healthz(self):
        response = self.fetch('/healthz')
        self.assertEqual(200, response.code)
        self.assertEqual(b'ok', response.body)

        self._is_healthy = False
        response = self.fetch('/healthz')
        self.assertEqual(503, response.code)


class MetricsHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /metrics endpoint"""
    def get_app(self):
        return tornado.web.Application([
            (r'/metrics', MetricsHandler),
        ])

    def test_metrics(self):
        config.set_option('global.metrics', False)
        response = self.fetch('/metrics')
        self.assertEqual(404, response.code)

        config.set_option('global.metrics', True)
        response = self.fetch('/metrics')
        self.assertEqual(200, response.code)


class DebugHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /debugz endpoint"""
    def get_app(self):
        return tornado.web.Application([
            (r'/debugz', DebugHandler),
        ])

    def test_debug(self):
        # TODO - debugz is currently broken
        pass
