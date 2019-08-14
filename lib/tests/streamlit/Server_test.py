# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import unittest

import tornado.web
from mock import patch
from tornado.testing import AsyncHTTPTestCase

from streamlit.server import Server
from streamlit.server.routes import HealthHandler


class ServerUtilsTest(unittest.TestCase):
    def test_is_url_from_allowed_origins_allowed_domains(self):
        self.assertTrue(
            Server._is_url_from_allowed_origins('localhost'))
        self.assertTrue(
            Server._is_url_from_allowed_origins('127.0.0.1'))

    def test_is_url_from_allowed_origins_CORS_off(self):
        with patch('streamlit.server.Server.config.get_option',
                   side_effect=[False]):
            self.assertTrue(
                Server._is_url_from_allowed_origins('does not matter'))

    def test_is_url_from_allowed_origins_s3_bucket(self):
        with patch('streamlit.server.Server.config.get_option',
                   side_effect=[True, 'mybucket']):
            self.assertTrue(
                Server._is_url_from_allowed_origins('mybucket'))

    def test_is_url_from_allowed_origins_browser_serverAddress(self):
        with patch('streamlit.server.Server.config.is_manually_set',
                   side_effect=[True]), \
                patch('streamlit.server.Server.config.get_option',
                      side_effect=[True, 'browser.server.address']):
            self.assertTrue(Server._is_url_from_allowed_origins(
                'browser.server.address'))

    def test_is_url_from_allowed_origins_s3_url(self):
        with patch('streamlit.server.Server.config.is_manually_set',
                   side_effect=[True]), \
                patch('streamlit.server.Server.config.get_option',
                      side_effect=[True, 's3.amazon.com']):
            self.assertTrue(
                Server._is_url_from_allowed_origins('s3.amazon.com'))


class HealthHandlerTest(AsyncHTTPTestCase):
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
        """Test that a healthy server returns OK"""
        response = self.fetch('/healthz')
        self.assertEqual(200, response.code)
        self.assertEqual(b'ok', response.body)

        self._is_healthy = False
        response = self.fetch('/healthz')
        self.assertEqual(503, response.code)
