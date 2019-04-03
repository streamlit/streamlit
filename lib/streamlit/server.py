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
from streamlit.ReportQueue import ReportQueue
from streamlit.proxy.ReportObserver import ReportObserver  # XXX Move out of proxy

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Largest message that can be sent via the WebSocket connection.
# (Limit was picked by trial and error)
# TODO: Break message in several chunks if too large.
MESSAGE_SIZE_LIMIT = 10466493


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
        LOGGER.debug('Initializing server...')
        Server._singleton = self

        _fix_tornado_logging()

        self._master_queue = ReportQueue()

        # Mapping of WebSocket->ReportQueue.
        self._browser_queues = {}

        self._report_observer = None
        self._must_stop = threading.Event()
        self._state = None
        self._set_state(State.INITIAL)

        # This gets set externally and is only used outside of this class,
        # but should logically live here since each server must only send a
        # single "new connection" message ever.
        self.sent_new_connection_message = False

        port = config.get_option('proxy.port')
        app = tornado.web.Application(_get_routes())
        app.listen(port)

        LOGGER.debug('Server started on port %s', port)

    def _set_state(self, new_state):
        LOGGER.debug('Server state: %s -> %s' % (self._state, new_state))
        self._state = new_state

    @tornado.gen.coroutine
    def loop_coroutine(self):
        self._set_state(State.WAITING_FOR_FIRST_BROWSER)

        while not self._must_stop.is_set():
            if self._state == State.WAITING_FOR_FIRST_BROWSER:
                pass

            elif self._state == State.ONE_OR_MORE_BROWSERS_CONNECTED:

                for ws, browser_queue in self._browser_queues.items():
                    msg_list = browser_queue.flush()
                    for msg in msg_list:
                        msg_str = _serialize(msg)
                        if ws is None:
                            break
                        ws.write_message(msg_str, binary=True)
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
        """Enqueue message in a thread-safe manner."""
        self._master_queue.enqueue(msg)

        for browser_queue in self._browser_queues.values():
            browser_queue.enqueue(msg)

    def add_browser_connection(self, ws):
        if ws not in self._browser_queues:
            self._set_state(State.ONE_OR_MORE_BROWSERS_CONNECTED)
            self._browser_queues[ws] = self._master_queue.clone()

        self._add_report_observer(ws)

    def remove_browser_connection(self, ws):
        self._remove_report_observer(ws)

        if ws in self._browser_queues:
            del self._browser_queues[ws]
        if len(self._browser_queues) == 0:
            self._set_state(State.NO_BROWSERS_CONNECTED)

    def _add_report_observer(self, browser_key):
        """Start observer and store in self._report_observer.

        Parameters
        ----------
        browser_key : str
            A unique identifier of the browser connection.

        """
        from streamlit.scriptrunner import ScriptRunner
        scriptrunner = ScriptRunner.get_instance()
        file_path = scriptrunner.file_path

        # XXX This will never happen. This was here for the REPL.
        if file_path is None:
            LOGGER.debug('Will not observe file; '
                         'connection\'s file_path is None')
            return

        if self._report_observer is None:
            initially_enabled = config.get_option('proxy.watchFileSystem')
            self._report_observer = ReportObserver(
                initially_enabled=initially_enabled,
                file_path=file_path,
                on_file_changed=_handle_rerun_script_request)

        self._report_observer.register_browser(browser_key)

    def _remove_report_observer(self, browser_key):
        """Stop observing filesystem.

        Parameters
        ----------
        browser_key : str
            A unique identifier of the browser connection.

        """
        if self._report_observer is None:
            return

        self._report_observer.deregister_browser(browser_key)
        if not self._report_observer.has_registered_browsers:
            self._report_observer = None



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
                pass #XXX _save_cloud(connection, ws)
            elif msg_type == 'rerun_script':
                _handle_rerun_script_request()
            elif msg_type == 'clear_cache':
                _handle_clear_cache_request()
            else:
                LOGGER.warning('No handler for "%s"', msg_type)

        except BaseException as e:
            LOGGER.error('Cannot parse binary message: %s', e)


def _save_cloud(msg):
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


def _handle_rerun_script_request():
    # XXX TODO change msg.rerun_script to remove file
    # TODO handle command-line arguments
    from streamlit.scriptrunner import ScriptRunner
    scriptrunner = ScriptRunner.get_instance()
    scriptrunner.request_rerun()


def _handle_clear_cache_request():
    # Setting verbose=True causes clear_cache to print to stdout.
    # Since this command was initiated from the browser, the user
    # doesn't need to see the results of the command in their
    # terminal.
    caching.clear_cache(verbose=False)


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


def _serialize(msg):
    msg_str = msg.SerializeToString()

    if len(msg_str) > MESSAGE_SIZE_LIMIT:
        _convert_msg_to_exception_msg(msg, RuntimeError('Data too large'))
        msg_str = msg.SerializeToString()

    return msg_str


def _convert_msg_to_exception_msg(msg, e):
    import streamlit.exception as exception_module

    delta_id = msg.delta.id
    msg.Clear()
    msg.delta.id = delta_id

    exception_module.marshall(msg.delta.new_element, e)
