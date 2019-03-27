# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import collections
import json
import logging
import os
import threading
import tornado.concurrent
import tornado.gen
import tornado.web
import tornado.websocket

from streamlit import caching
from streamlit import config
from streamlit import util
from streamlit import protobuf

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class State(object):
    INITIAL = 'INITIAL'
    WAITING_FOR_FIRST_BROWSER = 'WAITING_FOR_FIRST_BROWSER'
    ONE_OR_MORE_BROWSERS_CONNECTED = 'ONE_OR_MORE_BROWSERS_CONNECTED'
    NO_BROWSERS_CONNECTED = 'NO_BROWSERS_CONNECTED'
    STOPPING = 'STOPPING'
    STOPPED = 'STOPPED'


class Server(object):

    _singleton = None

    @classmethod
    def get_instance(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Server()

        s = Server._singleton
        return s

    # Don't allow constructor to be called more than once.
    def __new__(cls):
        """Constructor."""
        if Server._singleton is not None:
            raise RuntimeError('Use .get_instance() instead')
        return super(Server, cls).__new__(cls)

    def __init__(self):
        """Initialize."""
        Server._singleton = self

        _fix_tornado_logging()

        self._master_queue = collections.deque()
        self._browser_queues = {}
        self._must_stop = threading.Event()

        self._state = None
        self._set_state(State.INITIAL)

        port = config.get_option('proxy.port')
        app = tornado.web.Application(_get_routes())
        app.listen(port)

        LOGGER.debug('Proxy HTTP server for started on port %s', port)

    def _set_state(self, state):
        self._state = state

    @tornado.gen.coroutine
    def loop_coroutine(self):
        self._set_state(State.WAITING_FOR_FIRST_BROWSER)

        while not self._must_stop.is_set():
            if self._state == State.WAITING_FOR_FIRST_BROWSER:
                pass

            elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:

                # Grab this before the "for" loop, so it doesn't change while
                # we loop through its elements.
                browser_queues = list(self._browser_queues.items())

                for ws, browser_queue in browser_queues:
                    while len(browser_queue):
                        msg = browser_queue.popleft()
                        ws.write_message(msg.SerializeToString(), binary=True)
                        yield
                    yield

            elif self._state == State.NO_BROWSERS_CONNECTED:
                pass

            else:
                # Break out of the thread loop if we encounter any other state.
                break

            yield tornado.gen.sleep(0.01)

        self._set_state(State.STOPPED)

    def stop(self):
        self._set_state(State.STOPPING)
        self._must_stop.set()

    def clear_queue(self):
        self._master_queue.clear()
        for browser_queue in self._browser_queues.values():
            browser_queue.clear()

    def enqueue(self, msg):
        # TODO: Do compose operation here, etc. XXX
        # XXX Should just use ReportQueue here instead XXX THIS
        # Maybe only append to the master queue here?
        self._master_queue.append(msg)
        for browser_queue in self._browser_queues.values():
            browser_queue.append(msg)

    def add_browser_connection(self, ws):
        if ws not in self._browser_queues:
            self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)
            self._browser_queues[ws] = collections.deque(self._master_queue)

    def remove_browser_connection(self, ws):
        if ws in self._browser_queues:
            del self._browser_queues[ws]
        if len(self._browser_queues) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)


class _SocketHandler(tornado.websocket.WebSocketHandler):
    def check_origin(self, origin):
        return True

    def open(self):
        Server.get_instance().add_browser_connection(self)

    def on_close(self):
        Server.get_instance().remove_browser_connection(self)

    @tornado.gen.coroutine
    def on_message(self, payload):
        msg = protobuf.BackMsg()

        try:
            msg.ParseFromString(payload)
            LOGGER.debug('Received the following backend message: %s' % msg)

            msg_type = msg.WhichOneof('type')

            if msg_type == 'cloud_upload':
                yield #XXX self._save_cloud(connection, ws)
            elif msg_type == 'rerun_script':
                yield self._handle_rerun_script_request(msg)
            elif msg_type == 'clear_cache':
                yield self._handle_clear_cache_request(msg)
            else:
                LOGGER.warning('No handler for "%s"', msg_type)

        except BaseException as e:
            LOGGER.error('Cannot parse binary message: %s', e)

    @tornado.gen.coroutine
    def _save_cloud(self, msg):
        """Save serialized version of report deltas to the cloud."""
        pass
        # XXX

        # @tornado.gen.coroutine
        # def progress(percent):
        #     progress_msg = protobuf.ForwardMsg()
        #     progress_msg.upload_report_progress = percent
        #     yield self.write_message(
        #         progress_msg.SerializeToString(), binary=True)

        # # Indicate that the save is starting.
        # try:
        #     yield progress(0)

        #     files = connection.serialize_final_report_to_files()
        #     storage = self._proxy.get_storage()
        #     url = yield storage.save_report_files(
        #         connection.id, files, progress)

        #     # Indicate that the save is done.
        #     progress_msg = protobuf.ForwardMsg()
        #     progress_msg.report_uploaded = url
        #     yield self.write_message(
        #         progress_msg.SerializeToString(), binary=True)
        # except Exception as e:
        #     # Horrible hack to show something if something breaks.
        #     err_msg = '%s: %s' % (
        #         type(e).__name__, str(e) or "No further details.")
        #     progress_msg = protobuf.ForwardMsg()
        #     progress_msg.report_uploaded = err_msg
        #     yield self.write_message(
        #         progress_msg.SerializeToString(), binary=True)
        #     raise e

    @tornado.gen.coroutine
    def _handle_rerun_script_request(self, msg):
        # XXX TODO change msg.rerun_script
        from streamlit.scriptrunner import ScriptRunner
        scriptrunner = ScriptRunner.get_instance()
        yield scriptrunner.request_rerun()

    @tornado.gen.coroutine
    def _handle_clear_cache_request(self, msg):
        # Setting verbose=True causes clear_cache to print to stdout.
        # Since this command was initiated from the browser, the user
        # doesn't need to see the results of the command in their
        # terminal.
        yield caching.clear_cache(verbose=False)


def _fix_tornado_logging():
    if not config.get_option('global.developmentMode'):
        # Hide logs unless they're super important.
        # Example of stuff we don't care about: 404 about .js.map files.
        logging.getLogger('tornado.access').setLevel(logging.ERROR)
        logging.getLogger('tornado.application').setLevel(logging.ERROR)
        logging.getLogger('tornado.general').setLevel(logging.ERROR)


def _get_routes():
    routes = [(r'/stream', _SocketHandler)]

    if not config.get_option('proxy.useNode'):
        # If we're not using the node development server, then the proxy
        # will serve up the development pages.
        static_path = util.get_static_dir()
        LOGGER.debug('Serving static content from %s', static_path)

        routes.extend([
            (r"/()$", tornado.web.StaticFileHandler,
                {'path': '%s/index.html' % static_path}),
            (r"/(.*)", tornado.web.StaticFileHandler,
                {'path': '%s/' % static_path}),
        ])
    else:
        LOGGER.debug(
            'useNode == True, not serving static content from python.')

    return routes
