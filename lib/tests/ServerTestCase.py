# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import mock
import requests
import tornado.testing
import tornado.web
import tornado.websocket
from tornado.concurrent import Future

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
        self.server = Server(self.io_loop, '/not/a/script.py', [])
        self.server._on_stopped = mock.MagicMock()
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
            self.server._loop_coroutine,
            lambda _: server_started.set_result(None))
        return server_started

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
        Future
            A Future that resolves with the connected websocket client.
            You need to yield on this value from within a
            'tornado.testing.gen_test' coroutine.

        """
        return tornado.websocket.websocket_connect(self.get_ws_url('/stream'))
