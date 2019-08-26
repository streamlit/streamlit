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
from mock import MagicMock
from mock import patch
from tornado import gen

from streamlit import config
from streamlit.MessageCache import MessageCache
from streamlit.MessageCache import ensure_hash
from streamlit.elements import data_frame_proto
from streamlit.proto.BlockPath_pb2 import BlockPath
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.Server import State
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import serialize_forward_msg
from streamlit.server.server_util import should_cache_msg
from tests.ServerTestCase import ServerTestCase


def _create_dataframe_msg(df, id=1):
    msg = ForwardMsg()
    msg.delta.id = id
    msg.delta.parent_block.container = BlockPath.SIDEBAR
    data_frame_proto.marshall_data_frame(df, msg.delta.new_element.data_frame)
    return msg


# Stub out the Server's ReportSession import. We don't want
# actual sessions to be instantiated, or scripts to be run.
# Test methods must take an additional parameter (mock.patch
# will pass the mocked stub to each test function.)
@mock.patch('streamlit.server.Server.ReportSession', autospec=True)
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

    @tornado.testing.gen_test
    def test_forwardmsg_hashing(self, _):
        """Test that outgoing ForwardMsgs contain hashes."""
        yield self.start_server_loop()

        ws_client = yield self.ws_connect()

        # Get the server's socket and session for this client
        ws, session = list(self.server._report_sessions.items())[0]

        # Create a message and ensure its hash is unset; we're testing
        # that _send_message adds the hash before it goes out.
        msg = _create_dataframe_msg([1, 2, 3])
        msg.ClearField('hash')
        self.server._send_message(ws, session, msg)

        received = yield self.read_forward_msg(ws_client)
        self.assertEqual(ensure_hash(msg), received.hash)

    @tornado.testing.gen_test
    def test_duplicate_forwardmsg_caching(self, _):
        """Test that duplicate ForwardMsgs are sent only once."""
        with mock.patch('streamlit.server.server_util.CACHED_MESSAGE_SIZE_MIN', 0):
            yield self.start_server_loop()
            ws_client = yield self.ws_connect()

            # Get the server's socket and session for this client
            ws, session = list(self.server._report_sessions.items())[0]

            msg1 = _create_dataframe_msg([1, 2, 3], 1)

            # Send the message, and read it back. It will not have been cached.
            self.server._send_message(ws, session, msg1)
            uncached = yield self.read_forward_msg(ws_client)
            self.assertEqual('delta', uncached.WhichOneof('type'))

            msg2 = _create_dataframe_msg([1, 2, 3], 123)

            # Send an equivalent message. This time, it should be cached,
            # and a "hash_reference" message should be received instead.
            self.server._send_message(ws, session, msg2)
            cached = yield self.read_forward_msg(ws_client)
            self.assertEqual('ref', cached.WhichOneof('type'))
            # We should have the same *hash* as msg1:
            self.assertEqual(msg1.hash, cached.ref.hash)
            # And the same *delta metadata* as msg2:
            self.assertEqual(msg2.delta.id, cached.ref.delta_id)
            self.assertEqual(msg2.delta.parent_block,
                             cached.ref.delta_parent_block)


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
        with mock.patch('streamlit.server.server_util.CACHED_MESSAGE_SIZE_MIN', 0):
            self.assertTrue(should_cache_msg(_create_dataframe_msg([1, 2, 3])))

        with mock.patch('streamlit.server.server_util.CACHED_MESSAGE_SIZE_MIN', 1000):
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
        msg_hash = ensure_hash(msg)
        self._cache.add_message(msg, MagicMock())

        # Cache hit
        response = self.fetch('/message?hash=%s' % msg_hash)
        self.assertEqual(200, response.code)
        self.assertEqual(serialize_forward_msg(msg), response.body)

        # Cache misses
        self.assertEqual(404, self.fetch('/message').code)
        self.assertEqual(404, self.fetch('/message?id=non_existent').code)
