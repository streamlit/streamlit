# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import json

import tornado.web

from streamlit import config
from streamlit import metrics
from streamlit.logger import get_logger
from streamlit.server.server_util import serialize_forward_msg

LOGGER = get_logger(__name__)


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


class MessageCacheHandler(_SpecialRequestHandler):
    """Returns ForwardMsgs from our MessageCache"""
    def initialize(self, cache):
        """Initializes the handler.

        Parameters
        ----------
        cache : MessageCache

        """
        self._cache = cache

    def get(self):
        msg_hash = self.get_argument('hash', None)
        if msg_hash is None:
            # ID is missing
            LOGGER.warning('MessageCacheHandler.get: missing hash')
            self.set_status(404)
            raise tornado.web.Finish()

        message = self._cache.get_message(msg_hash)
        if message is None:
            # Message not in our cache
            LOGGER.debug('MessageCache MISS [hash=%s]' % msg_hash)
            self.set_status(404)
            raise tornado.web.Finish()

        LOGGER.debug('MessageCache HIT [hash=%s]' % msg_hash)
        msg_str = serialize_forward_msg(message)
        self.write(msg_str)
        self.set_status(200)
