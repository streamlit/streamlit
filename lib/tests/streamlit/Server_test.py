# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import unittest

import tornado.testing
import tornado.web
from mock import MagicMock
from mock import patch

from streamlit import config
from streamlit.MessageCache import MessageCache
from streamlit.MessageCache import ensure_id
from streamlit.elements import data_frame_proto
from streamlit.protobuf.ForwardMsg_pb2 import ForwardMsg
from streamlit.server import server_util
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import serialize_forward_msg
from streamlit.server.server_util import should_cache_msg


def _create_dataframe_msg(df):
    msg = ForwardMsg()
    msg.delta.id = 1
    data_frame_proto.marshall_data_frame(df, msg.delta.new_element.data_frame)
    return msg


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

    def test_should_cache_msg(self):
        """Test server_util.should_cache_msg"""
        server_util.CACHED_MESSAGE_SIZE_MIN = 1
        self.assertTrue(should_cache_msg(_create_dataframe_msg([1, 2, 3])))

        server_util.CACHED_MESSAGE_SIZE_MIN = 1000
        self.assertFalse(should_cache_msg(_create_dataframe_msg([1, 2, 3])))


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


class MessageCacheHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self._cache = MessageCache()
        return tornado.web.Application([
            (r'/message', MessageCacheHandler, dict(cache=self._cache)),
        ])

    def test_message_cache(self):
        # Create a new ForwardMsg and cache it
        msg = _create_dataframe_msg([1, 2, 3])
        msg_id = ensure_id(msg)
        self._cache.add_message(msg, MagicMock())

        # Cache hit
        response = self.fetch('/message?id=%s' % msg_id)
        self.assertEqual(200, response.code)
        self.assertEqual(serialize_forward_msg(msg), response.body)

        # Cache misses
        self.assertEqual(404, self.fetch('/message').code)
        self.assertEqual(404, self.fetch('/message?id=non_existent').code)


