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
import pytest
import tornado.testing
import tornado.web
import tornado.websocket
import errno
from mock import MagicMock
from mock import patch
from tornado import gen

import streamlit.server.Server
from streamlit import config
from streamlit.server.Server import server_port_is_manually_set
from streamlit.server.Server import MAX_PORT_SEARCH_RETRIES
from streamlit.ForwardMsgCache import ForwardMsgCache
from streamlit.ForwardMsgCache import populate_hash_if_needed
from streamlit.elements import data_frame_proto
from streamlit.proto.BlockPath_pb2 import BlockPath
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.Server import State
from streamlit.server.Server import start_listening
from streamlit.server.Server import RetriesExceeded
from streamlit.server.routes import DebugHandler
from streamlit.server.routes import HealthHandler
from streamlit.server.routes import MessageCacheHandler
from streamlit.server.routes import MetricsHandler
from streamlit.server.server_util import is_cacheable_msg
from streamlit.server.server_util import is_url_from_allowed_origins
from streamlit.server.server_util import serialize_forward_msg
from tests.ServerTestCase import ServerTestCase

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def _create_dataframe_msg(df, id=1):
    msg = ForwardMsg()
    msg.metadata.delta_id = id
    msg.metadata.parent_block.container = BlockPath.SIDEBAR
    data_frame_proto.marshall_data_frame(df, msg.delta.new_element.data_frame)
    return msg


def _create_report_finished_msg(status):
    msg = ForwardMsg()
    msg.report_finished = status
    return msg


class ServerTest(ServerTestCase):
    def _patch_report_session(self):
        """Mock the Server's ReportSession import. We don't want
        actual sessions to be instantiated, or scripts to be run.
        """

        return mock.patch("streamlit.server.Server.ReportSession", autospec=True)

    @tornado.testing.gen_test
    def test_start_stop(self):
        """Test that we can start and stop the server."""
        with self._patch_report_session():
            yield self.start_server_loop()
            self.assertEqual(State.WAITING_FOR_FIRST_BROWSER, self.server._state)

            yield self.ws_connect()
            self.assertEqual(State.ONE_OR_MORE_BROWSERS_CONNECTED, self.server._state)

            self.server.stop()
            self.assertEqual(State.STOPPING, self.server._state)

            yield gen.sleep(0.1)
            self.assertEqual(State.STOPPED, self.server._state)

    @tornado.testing.gen_test
    def test_websocket_connect(self):
        """Test that we can connect to the server via websocket."""
        with self._patch_report_session():
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
    def test_forwardmsg_hashing(self):
        """Test that outgoing ForwardMsgs contain hashes."""
        with self._patch_report_session():
            yield self.start_server_loop()

            ws_client = yield self.ws_connect()

            # Get the server's socket and session for this client
            ws, session = list(self.server._session_infos.items())[0]

            # Create a message and ensure its hash is unset; we're testing
            # that _send_message adds the hash before it goes out.
            msg = _create_dataframe_msg([1, 2, 3])
            msg.ClearField("hash")
            self.server._send_message(ws, session, msg)

            received = yield self.read_forward_msg(ws_client)
            self.assertEqual(populate_hash_if_needed(msg), received.hash)

    @tornado.testing.gen_test
    def test_forwardmsg_cacheable_flag(self):
        """Test that the metadata.cacheable flag is set properly on outgoing
         ForwardMsgs."""
        with self._patch_report_session():
            yield self.start_server_loop()

            ws_client = yield self.ws_connect()

            # Get the server's socket and session for this client
            ws, session = list(self.server._session_infos.items())[0]

            config._set_option("global.minCachedMessageSize", 0, "test")
            cacheable_msg = _create_dataframe_msg([1, 2, 3])
            self.server._send_message(ws, session, cacheable_msg)
            received = yield self.read_forward_msg(ws_client)
            self.assertTrue(cacheable_msg.metadata.cacheable)
            self.assertTrue(received.metadata.cacheable)

            config._set_option("global.minCachedMessageSize", 1000, "test")
            cacheable_msg = _create_dataframe_msg([4, 5, 6])
            self.server._send_message(ws, session, cacheable_msg)
            received = yield self.read_forward_msg(ws_client)
            self.assertFalse(cacheable_msg.metadata.cacheable)
            self.assertFalse(received.metadata.cacheable)

    @tornado.testing.gen_test
    def test_duplicate_forwardmsg_caching(self):
        """Test that duplicate ForwardMsgs are sent only once."""
        with self._patch_report_session():
            config._set_option("global.minCachedMessageSize", 0, "test")

            yield self.start_server_loop()
            ws_client = yield self.ws_connect()

            # Get the server's socket and session for this client
            ws, session = list(self.server._session_infos.items())[0]

            msg1 = _create_dataframe_msg([1, 2, 3], 1)

            # Send the message, and read it back. It will not have been cached.
            self.server._send_message(ws, session, msg1)
            uncached = yield self.read_forward_msg(ws_client)
            self.assertEqual("delta", uncached.WhichOneof("type"))

            msg2 = _create_dataframe_msg([1, 2, 3], 123)

            # Send an equivalent message. This time, it should be cached,
            # and a "hash_reference" message should be received instead.
            self.server._send_message(ws, session, msg2)
            cached = yield self.read_forward_msg(ws_client)
            self.assertEqual("ref_hash", cached.WhichOneof("type"))
            # We should have the *hash* of msg1 and msg2:
            self.assertEqual(msg1.hash, cached.ref_hash)
            self.assertEqual(msg2.hash, cached.ref_hash)
            # And the same *metadata* as msg2:
            self.assertEqual(msg2.metadata, cached.metadata)

    @tornado.testing.gen_test
    def test_cache_clearing(self):
        """Test that report_run_count is incremented when a report
        finishes running.
        """
        with self._patch_report_session():
            config._set_option("global.minCachedMessageSize", 0, "test")
            config._set_option("global.maxCachedMessageAge", 1, "test")

            yield self.start_server_loop()
            yield self.ws_connect()

            ws, session = list(self.server._session_infos.items())[0]

            data_msg = _create_dataframe_msg([1, 2, 3])

            def finish_report(success):
                status = (
                    ForwardMsg.FINISHED_SUCCESSFULLY
                    if success
                    else ForwardMsg.FINISHED_WITH_COMPILE_ERROR
                )
                finish_msg = _create_report_finished_msg(status)
                self.server._send_message(ws, session, finish_msg)

            def is_data_msg_cached():
                return self.server._message_cache.get_message(data_msg.hash) is not None

            def send_data_msg():
                self.server._send_message(ws, session, data_msg)

            # Send a cacheable message. It should be cached.
            send_data_msg()
            self.assertTrue(is_data_msg_cached())

            # End the report with a compile error. Nothing should change;
            # compile errors don't increase the age of items in the cache.
            finish_report(False)
            self.assertTrue(is_data_msg_cached())

            # End the report successfully. Nothing should change, because
            # the age of the cached message is now 1.
            finish_report(True)
            self.assertTrue(is_data_msg_cached())

            # Send the message again. This should reset its age to 0 in the
            # cache, so it won't be evicted when the report next finishes.
            send_data_msg()
            self.assertTrue(is_data_msg_cached())

            # Finish the report. The cached message age is now 1.
            finish_report(True)
            self.assertTrue(is_data_msg_cached())

            # Finish again. The cached message age will be 2, and so it
            # should be evicted from the cache.
            finish_report(True)
            self.assertFalse(is_data_msg_cached())


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

    def test_should_cache_msg(self):
        """Test server_util.should_cache_msg"""
        config._set_option("global.minCachedMessageSize", 0, "test")
        self.assertTrue(is_cacheable_msg(_create_dataframe_msg([1, 2, 3])))

        config._set_option("global.minCachedMessageSize", 1000, "test")
        self.assertFalse(is_cacheable_msg(_create_dataframe_msg([1, 2, 3])))


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


class PortRotateAHundredTest(unittest.TestCase):
    """Tests port rotation handles a MAX_PORT_SEARCH_RETRIES attempts then sys exits"""

    def get_app(self):
        app = mock.MagicMock()

        app.listen = mock.Mock()
        app.listen.side_effect = OSError(errno.EADDRINUSE, "test", "asd")

        return app

    def test_rotates_a_hundred_ports(self):
        app = self.get_app()
        with pytest.raises(SystemExit) as pytest_wrapped_e:
            start_listening(app)

            assert pytest_wrapped_e.type == SystemExit
            assert pytest_wrapped_e.value.code == errno.EADDRINUSE

            assert app.listen.call_count == MAX_PORT_SEARCH_RETRIES


class PortRotateOneTest(unittest.TestCase):
    """Tests port rotates one port"""

    which_port = mock.Mock()

    def get_app(self):
        app = mock.MagicMock()

        app.listen = mock.Mock()
        app.listen.side_effect = OSError(errno.EADDRINUSE, "test", "asd")

        return app

    @mock.patch("streamlit.server.Server.config._set_option")
    @mock.patch("streamlit.server.Server.server_port_is_manually_set")
    def test_rotates_one_port(
        self, patched_server_port_is_manually_set, patched__set_option
    ):
        app = self.get_app()

        patched_server_port_is_manually_set.return_value = False
        with pytest.raises(RetriesExceeded) as pytest_wrapped_e:
            start_listening(app)

            PortRotateOneTest.which_port.assert_called_with(8502)

            patched__set_option.assert_called_with(
                "server.port", 8501, "server initialization"
            )


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


class MessageCacheHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        self._cache = ForwardMsgCache()
        return tornado.web.Application(
            [(r"/message", MessageCacheHandler, dict(cache=self._cache))]
        )

    def test_message_cache(self):
        # Create a new ForwardMsg and cache it
        msg = _create_dataframe_msg([1, 2, 3])
        msg_hash = populate_hash_if_needed(msg)
        self._cache.add_message(msg, MagicMock(), 0)

        # Cache hit
        response = self.fetch("/message?hash=%s" % msg_hash)
        self.assertEqual(200, response.code)
        self.assertEqual(serialize_forward_msg(msg), response.body)

        # Cache misses
        self.assertEqual(404, self.fetch("/message").code)
        self.assertEqual(404, self.fetch("/message?id=non_existent").code)
