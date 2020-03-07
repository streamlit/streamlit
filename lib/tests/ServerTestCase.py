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

import mock
import tornado.testing
import tornado.web
import tornado.websocket
import urllib.parse
from tornado import gen
from tornado.concurrent import Future

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.Server import Server


class ServerTestCase(tornado.testing.AsyncHTTPTestCase):
    """Base class for async streamlit.Server testing.

    Subclasses should patch 'streamlit.server.Server.ReportSession',
    to prevent ReportSessions from being created, and scripts from
    being run. (Script running involves creating new threads, which
    interfere with other tests if not properly terminated.)

    See the "ServerTest" class for example usage.
    """

    def get_app(self):
        # Create a Server, and patch its _on_stopped function
        # to no-op. This prevents it from shutting down the
        # ioloop when it stops.
        self.server = Server(self.io_loop, "/not/a/script.py", "test command line")
        self.server._on_stopped = mock.MagicMock()  # type: ignore[assignment]
        app = self.server._create_app()
        return app

    def tearDown(self):
        super(ServerTestCase, self).tearDown()
        # Clear the Server singleton for the next test
        Server._singleton = None

    def start_server_loop(self):
        """Starts the server's loop coroutine.

        Returns
        -------
        Future
            A Future that resolves when the loop has started.
            You need to yield on this value from within a
            'tornado.testing.gen_test' coroutine.

        """
        server_started = Future()
        self.io_loop.spawn_callback(
            self.server._loop_coroutine, lambda _: server_started.set_result(None)
        )
        return server_started

    def get_ws_url(self, path):
        """Return a ws:// URL with the given path for our test server."""
        # get_url() gives us a result with the 'http' scheme;
        # we swap it out for 'ws'.
        url = self.get_url(path)
        parts = list(urllib.parse.urlparse(url))
        parts[0] = "ws"
        return urllib.parse.urlunparse(tuple(parts))

    def ws_connect(self):
        """Open a websocket connection to the server.

        Returns
        -------
        Future
            A Future that resolves with the connected websocket client.
            You need to yield on this value from within a
            'tornado.testing.gen_test' coroutine.

        """
        return tornado.websocket.websocket_connect(self.get_ws_url("/stream"))

    @tornado.gen.coroutine
    def read_forward_msg(self, ws_client):
        """Parse the next message from a Websocket client into a ForwardMsg."""
        data = yield ws_client.read_message()
        message = ForwardMsg()
        message.ParseFromString(data)
        raise gen.Return(message)
