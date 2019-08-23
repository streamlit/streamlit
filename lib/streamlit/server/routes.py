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

import json

import tornado.web

from streamlit import config
from streamlit import metrics


class StaticFileHandler(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        """Disable cache for HTML files.

        Other assets like JS and CSS are suffixed with their hash, so they can
        be cached indefinitely.
        """
        is_index_url = len(path) == 0

        if is_index_url or path.endswith('.html'):
            self.set_header('Cache-Control', 'no-cache')
        else:
            self.set_header('Cache-Control', 'public')


class _SpecialRequestHandler(tornado.web.RequestHandler):
    """Superclass for "special" endpoints, like /healthz."""
    def set_default_headers(self):
        self.set_header('Cache-Control', 'no-cache')
        # Only allow cross-origin requests when using the Node server. This is
        # only needed when using the Node server anyway, since in that case we
        # have a dev port and the prod port, which count as two origins.
        if (not config.get_option('server.enableCORS') or
                config.get_option('global.useNode')):
            self.set_header('Access-Control-Allow-Origin', '*')


class HealthHandler(_SpecialRequestHandler):
    def initialize(self, health_check):
        """Initialize the handler

        Parameters
        ----------
        health_check : callable
            A function that returns True if the server is healthy

        """
        self._health_check = health_check

    def get(self):
        if self._health_check():
            self.write('ok')
            self.set_status(200)
        else:
            # 503 = SERVICE_UNAVAILABLE
            self.set_status(503)
            self.write('unavailable')


class MetricsHandler(_SpecialRequestHandler):
    def get(self):
        if config.get_option('global.metrics'):
            self.add_header('Cache-Control', 'no-cache')
            self.set_header('Content-Type', 'text/plain')
            self.write(metrics.Client.get_current().generate_latest())
        else:
            self.set_status(404)
            raise tornado.web.Finish()


class DebugHandler(_SpecialRequestHandler):
    def initialize(self, server):
        self._server = server

    def get(self):
        self.add_header('Cache-Control', 'no-cache')
        self.write(
            '<code><pre>%s</pre><code>' %
            json.dumps(
                self._server.get_debug(),
                indent=2,
            ))
