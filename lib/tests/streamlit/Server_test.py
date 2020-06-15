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
from streamlit.ReportSession import ReportSession
from streamlit.UploadedFileManager import UploadedFile
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
    _next_report_id = 0

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

            # Get this client's SessionInfo object
            self.assertEqual(1, len(self.server._session_info_by_id))
            session_info = list(self.server._session_info_by_id.values())[0]

            # Close the connection
            ws_client.close()
            yield gen.sleep(0.1)
            self.assertFalse(self.server.browser_is_connected)

            # Ensure ReportSession.shutdown() was called, and that our
            # SessionInfo was cleared.
            session_info.session.shutdown.assert_called_once()
            self.assertEqual(0, len(self.server._session_info_by_id))

    @tornado.testing.gen_test
    def test_multiple_connections(self):
        """Test multiple websockets can connect simultaneously."""

        with self._patch_report_session():
            yield self.start_server_loop()

            self.assertFalse(self.server.browser_is_connected)

            # Open a websocket connection
            ws_client1 = yield self.ws_connect()
            self.assertTrue(self.server.browser_is_connected)

            # Open another
            ws_client2 = yield self.ws_connect()
            self.assertTrue(self.server.browser_is_connected)

            # Assert that our session_infos are sane
            session_infos = list(self.server._session_info_by_id.values())
            self.assertEqual(2, len(session_infos))
            self.assertNotEqual(
                session_infos[0].session.id, session_infos[1].session.id,
            )

            # Close the first
            ws_client1.close()
            yield gen.sleep(0.1)
            self.assertTrue(self.server.browser_is_connected)

            # Close the second
            ws_client2.close()
            yield gen.sleep(0.1)
            self.assertFalse(self.server.browser_is_connected)

    @tornado.testing.gen_test
    def test_websocket_compression(self):
        with self._patch_report_session():
            yield self.start_server_loop()

            # Connect to the server, and explicitly request compression.
            ws_client = yield tornado.websocket.websocket_connect(
                self.get_ws_url("/stream"), compression_options={}
            )

            # Ensure that the "permessage-deflate" extension is returned
            # from the server.
            extensions = ws_client.headers.get("Sec-Websocket-Extensions")
            self.assertIn("permessage-deflate", extensions)

    @tornado.testing.gen_test
    def test_forwardmsg_hashing(self):
        """Test that outgoing ForwardMsgs contain hashes."""
        with self._patch_report_session():
            yield self.start_server_loop()

            ws_client = yield self.ws_connect()

            # Get the server's socket and session for this client
            session_info = list(self.server._session_info_by_id.values())[0]

            # Create a message and ensure its hash is unset; we're testing
            # that _send_message adds the hash before it goes out.
            msg = _create_dataframe_msg([1, 2, 3])
            msg.ClearField("hash")
            self.server._send_message(session_info, msg)

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
            session_info = list(self.server._session_info_by_id.values())[0]

            config._set_option("global.minCachedMessageSize", 0, "test")
            cacheable_msg = _create_dataframe_msg([1, 2, 3])
            self.server._send_message(session_info, cacheable_msg)
            received = yield self.read_forward_msg(ws_client)
            self.assertTrue(cacheable_msg.metadata.cacheable)
            self.assertTrue(received.metadata.cacheable)

            config._set_option("global.minCachedMessageSize", 1000, "test")
            cacheable_msg = _create_dataframe_msg([4, 5, 6])
            self.server._send_message(session_info, cacheable_msg)
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
            session_info = list(self.server._session_info_by_id.values())[0]

            msg1 = _create_dataframe_msg([1, 2, 3], 1)

            # Send the message, and read it back. It will not have been cached.
            self.server._send_message(session_info, msg1)
            uncached = yield self.read_forward_msg(ws_client)
            self.assertEqual("delta", uncached.WhichOneof("type"))

            msg2 = _create_dataframe_msg([1, 2, 3], 123)

            # Send an equivalent message. This time, it should be cached,
            # and a "hash_reference" message should be received instead.
            self.server._send_message(session_info, msg2)
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

            session = list(self.server._session_info_by_id.values())[0]

            data_msg = _create_dataframe_msg([1, 2, 3])

            def finish_report(success):
                status = (
                    ForwardMsg.FINISHED_SUCCESSFULLY
                    if success
                    else ForwardMsg.FINISHED_WITH_COMPILE_ERROR
                )
                finish_msg = _create_report_finished_msg(status)
                self.server._send_message(session, finish_msg)

            def is_data_msg_cached():
                return self.server._message_cache.get_message(data_msg.hash) is not None

            def send_data_msg():
                self.server._send_message(session, data_msg)

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

    @tornado.testing.gen_test
    def test_uploaded_file_triggers_rerun(self):
        """Uploading a file should trigger a re-run in the associated
        ReportSession."""
        with self._patch_report_session():
            yield self.start_server_loop()

            # Connect twice and get associated ReportSessions
            yield self.ws_connect()
            yield self.ws_connect()
            session_info1 = list(self.server._session_info_by_id.values())[0]
            session_info2 = list(self.server._session_info_by_id.values())[1]

            file = UploadedFile("file.txt", b"123")

            # "Upload a file" for Session1
            self.server._uploaded_file_mgr.add_files(
                session_id=session_info1.session.id,
                widget_id="widget_id",
                files=[file],
            )

            self.assertEqual(
                self.server._uploaded_file_mgr.get_files(
                    session_info1.session.id, "widget_id"
                ),
                [file],
            )

            # Session1 should have a rerun request; Session2 should not
            session_info1.session.request_rerun.assert_called_once()
            session_info2.session.request_rerun.assert_not_called()

    @tornado.testing.gen_test
    def test_orphaned_upload_file_deletion(self):
        """An uploaded file with no associated ReportSession should be
        deleted."""
        with self._patch_report_session():
            yield self.start_server_loop()
            yield self.ws_connect()

            # "Upload a file" for a session that doesn't exist
            self.server._uploaded_file_mgr.add_files(
                session_id="no_such_session",
                widget_id="widget_id",
                files=[UploadedFile("file.txt", b"123")],
            )

            self.assertIsNone(
                self.server._uploaded_file_mgr.get_files("no_such_session", "widget_id")
            )

    @staticmethod
    def _create_mock_report_session(*args, **kwargs):
        """Create a mock ReportSession. Each mocked instance will have
        its own unique ID."""
        mock_id = mock.PropertyMock(
            return_value="mock_id:%s" % ServerTest._next_report_id
        )
        ServerTest._next_report_id += 1

        mock_session = mock.MagicMock(ReportSession, autospec=True, *args, **kwargs)
        type(mock_session).id = mock_id
        return mock_session

    def _patch_report_session(self):
        """Mock the Server's ReportSession import. We don't want
        actual sessions to be instantiated, or scripts to be run.
        """

        return mock.patch(
            "streamlit.server.Server.ReportSession",
            # new_callable must return a function, not an object, or else
            # there will only be a single ReportSession mock. Hence the lambda.
            new_callable=lambda: self._create_mock_report_session,
        )


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
            [(r"/healthz", HealthHandler, dict(callback=self.is_healthy))]
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

    def get_httpserver(self):
        httpserver = mock.MagicMock()

        httpserver.listen = mock.Mock()
        httpserver.listen.side_effect = OSError(errno.EADDRINUSE, "test", "asd")

        return httpserver

    def test_rotates_a_hundred_ports(self):
        app = mock.MagicMock()

        RetriesExceeded = streamlit.server.Server.RetriesExceeded
        with pytest.raises(RetriesExceeded) as pytest_wrapped_e:
            with patch.object(
                tornado.httpserver, "HTTPServer", return_value=self.get_httpserver()
            ) as mock_server:
                start_listening(app)
                self.assertEqual(pytest_wrapped_e.type, SystemExit)
                self.assertEqual(pytest_wrapped_e.value.code, errno.EADDRINUSE)
                self.assertEqual(mock_server.listen.call_count, MAX_PORT_SEARCH_RETRIES)


class PortRotateOneTest(unittest.TestCase):
    """Tests port rotates one port"""

    which_port = mock.Mock()

    def get_httpserver(self):
        httpserver = mock.MagicMock()

        httpserver.listen = mock.Mock()
        httpserver.listen.side_effect = OSError(errno.EADDRINUSE, "test", "asd")

        return httpserver

    @mock.patch("streamlit.server.Server.config._set_option")
    @mock.patch("streamlit.server.Server.server_port_is_manually_set")
    def test_rotates_one_port(
        self, patched_server_port_is_manually_set, patched__set_option
    ):
        app = mock.MagicMock()

        patched_server_port_is_manually_set.return_value = False
        with pytest.raises(RetriesExceeded) as pytest_wrapped_e:
            with patch.object(
                tornado.httpserver, "HTTPServer", return_value=self.get_httpserver()
            ) as mock_server:
                start_listening(app)

                PortRotateOneTest.which_port.assert_called_with(8502)

                patched__set_option.assert_called_with(
                    "server.port", 8501, config.ConfigOption.STREAMLIT_DEFINITION
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
