# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A proxy server between the Streamlit client and web browser.

Internally, the Proxy basically does bookkeeping for a set of ProxyConnection
objects. A ProxyConnection always has:

    - One ClientWebSocket connection to the client Python libs.
    - Zero or more BrowserWebSocket connections to a web browser.

Essentially, the ProxyConnection stays open so long as any of those connections
do. When the final ProxyConnection closes, then the whole proxy does too.
(...unless any of autoCloseDelaySecs or reportExpirationSecs are infinity, in
which case the proxy stays open no matter what.)

To ensure the proxy closes, a short timeout is launched for each connection
which closes the proxy if no connections were established.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import functools
import logging
import textwrap
import traceback

from tornado import gen, web
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop

from streamlit import config
from streamlit import util
from streamlit.proxy import process_runner
from streamlit.proxy import proxy_util
from streamlit.proxy.FSObserver import FSObserver
from streamlit.proxy.storage.S3Storage import S3Storage as Storage
from streamlit.streamlit_msg_proto import new_report_msg

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

if not config.get_option('global.developmentMode'):
    # Don't show per-request logs.
    logging.getLogger('tornado.access').setLevel(logging.WARNING)


class Proxy(object):
    """The main base class for the streamlit server."""

    def __init__(self):
        """Proxy constructor."""
        # This table from names to ProxyConnections stores all the information
        # about our connections. When the number of connections drops to zero,
        # then the proxy shuts down.
        self._connections = dict()

        # Map of key->FSObserver, where key is a tuple obtained with
        # FSObserver.get_key(proxy_connection).
        self._fs_observers = dict()

        # This object represents a connection to an S3 bucket or other cloud
        # storage solution. It is instantiated lazily by calling
        # get_storage() which is why it starts off as null.
        self._storage = None

        # How long to keep the proxy alive for, when there are no connections.
        self._auto_close_delay_secs = config.get_option(
            'proxy.autoCloseDelaySecs')

        self._report_expiration_secs = config.get_option(
            'proxy.reportExpirationSecs')

        self._keep_alive = (
            self._auto_close_delay_secs == float('inf') or
            self._report_expiration_secs == float('inf'))

        LOGGER.debug(
            f'Creating proxy with self._connections: {id(self._connections)}')

        self._set_up_server()

        # Remember whether we've seen any browser connections so that we can
        # display a helpful warming message if the proxy closed without having
        # received any connections.
        self._received_browser_connection = False

        # Avoids an exception by guarding against twice stopping the event loop.
        self._stopped = False

    def _set_up_server(self):
        # We have to import this in here to break a circular import reference
        # issue in Python 2.7.
        from streamlit.proxy import ClientWebSocket
        from streamlit.proxy import BrowserWebSocket

        routes = [
            ('/new/(.*)', ClientWebSocket, dict(proxy=self)),
            ('/stream/(.*)', BrowserWebSocket, dict(proxy=self)),
            ('/healthz', _HealthHandler),
        ]

        if not config.get_option('proxy.useNode'):
            # If we're not using the node development server, then the proxy
            # will serve up the development pages.
            static_path = util.get_static_dir()
            LOGGER.debug(f'Serving static content from {static_path}')

            routes.extend([
                (r"/()$", web.StaticFileHandler, {'path': f'{static_path}/index.html'}),
                (r"/(.*)", web.StaticFileHandler, {'path': f'{static_path}/'}),
            ])
        else:
            LOGGER.debug(
                'useNode == True, not serving static content from python.')

        app = web.Application(routes)
        port = config.get_option('proxy.port')

        http_server = HTTPServer(app)
        http_server.listen(port)

        LOGGER.debug('Proxy HTTP server for started on port {}'.format(port))

    def run_app(self):
        """Run web app."""
        LOGGER.debug('About to start the proxy.')
        IOLoop.current().start()
        LOGGER.debug('IOLoop closed.')

        # Give the user a helpful hint if no connection was received.
        headless = config.get_option('proxy.isRemote')
        if headless and not self._received_browser_connection:
            LOGGER.warning(
                'Connection timeout to proxy.\n'
                'Did you try to connect and nothing happened? '
                f'Go to {util.HELP_DOC} for debugging hints.')

    def stop(self):
        """Stop proxy.

        Allowing all current handler to exit normally.
        """
        LOGGER.debug('Stopping proxy')
        if not self._stopped:
            IOLoop.current().stop()
        self._stopped = True

    def register_proxy_connection(self, connection):
        """Register this connection's name.

        So that browser connections can connect to it.
        """
        LOGGER.debug(f'Registering proxy connection for "{connection.name}"')
        LOGGER.debug(
            f'About to start registration: '
            f'{list(self._connections.keys())} ({id(self._connections)})')

        # Open the browser and connect it to this report_name
        # (i.e. connection.name) if we don't have one open already.
        open_new_browser_connection = (
            not self._has_browser_connections(connection.name))

        self._connections[connection.name] = connection

        if open_new_browser_connection:
            if config.get_option('proxy.isRemote'):
                _print_urls(connection, self._auto_close_delay_secs)
            else:
                util.open_browser(connection.get_url_for_client_webbrowser())

        # Clean up the connection we don't get an incoming connection.
        def connection_timeout():
            LOGGER.debug(f'In connection timeout for "{connection.name}".')
            connection.end_grace_period()
            self.schedule_potential_deregister_and_stop(connection)

        if not self._keep_alive:
            connection_timeout()

        LOGGER.debug(
            f'Finished registering connection: '
            f'{list(self._connections.keys())} ({id(self._connections)})')

    def schedule_potential_deregister_and_stop(self, connection):
        """Try to deregister proxy connection.

        Deregister ProxyConnection so long as there aren't any open connection
        (client or browser), and the connection is no longer in its grace
        period.

        Parameters
        ----------
        connection : ProxyConnection

        """
        def potentially_unregister():
            if not self._proxy_connection_is_registered(connection):
                return

            if not connection.can_be_deregistered():
                return

            LOGGER.debug('Deregistering connection')
            self._deregister_proxy_connection(connection)
            self.schedule_potential_stop()

        LOGGER.debug(
            f'Will wait {self._report_expiration_secs}s before deregistering '
            'connection')

        loop = IOLoop.current()
        loop.call_later(self._report_expiration_secs, potentially_unregister)

    def _deregister_proxy_connection(self, connection):
        """Deregister proxy connection irrespective of whether it's in use.

        Parameters
        ----------
        connection : ProxyConnection
            The connection to deregister. It will be properly shutdown before
            deregistering.

        """
        del self._connections[connection.name]
        LOGGER.debug(f'Got rid of connection {connection.name}')
        LOGGER.debug(f'Total connections left: {len(self._connections)}')

    def _proxy_connection_is_registered(self, connection):
        """Return true if this connection is registered to its name."""
        return self._connections.get(connection.name, None) is connection

    def schedule_potential_stop(self):
        """Stop proxy if no open connections and not in keepAlive mode."""
        if self._keep_alive:
            return

        def potentially_stop():
            LOGGER.debug(
                'Stopping if there are no more connections: ' +
                str(list(self._connections.keys())))

            if not self._connections:
                self.stop()

        LOGGER.debug(
            f'Will check in {self._auto_close_delay_secs}s if there are no '
            'more connections: ')
        loop = IOLoop.current()
        loop.call_later(self._auto_close_delay_secs, potentially_stop)

    @gen.coroutine
    def on_browser_connection_opened(self, report_name, ws):  # noqa: D401
        """Called when a browser connection is opened.

        Parameters
        ----------
        report_name : str
            The name of the report the browser connection is for.
        ws : BrowserWebSocket
            The BrowserWebSocket instance that just got opened.

        Returns
        -------
        (ProxyConnection, ReportQueue)
            The new connection object which manages this connection to the
            proxy, as well as the queue this connection should write into.

        """
        connection, queue = yield self._register_browser(report_name, ws)
        self._maybe_add_fs_observer(connection)
        raise gen.Return((connection, queue))

    def on_browser_connection_closed(self, connection, queue):  # noqa: D401
        """Called when a browser connection is closed.

        Parameters
        ----------
        connection : ProxyConnection
            The ProxyConnection for the browser connection that just closed.
        queue : ReportQueue
            The queue for the closed browser connection.

        """
        self._remove_fs_observer(connection)
        self._deregister_browser(connection, queue)

    @gen.coroutine
    def get_latest_connection_and_queue(  # noqa: D401
            self, report_name, ws, connection, queue):
        """Get the most recent proxy connection and queue for this report_name.

        BrowserWebSocket continuously calls this method in case a new client
        connection was established, in which case the BrowserWebSocket should
        switch to the new proxy connection and queue.

        Parameters
        ----------
        report_name : str
            The name of the report the browser connection is for.
        ws : BrowserWebSocket
            The BrowserWebSocket instance that just got opened.
        connection : ProxyConnection
            The connection object that just got closed.
        queue : ReportQueue
            The client queue corresponding to the closed connection.

        Returns
        -------
        ProxyConnection
            The newly registered proxy connection.
        ReportQueue
            The corresponding newly registered queue.

        """
        # No need to change the connection or queue if the current one is still
        # registered.
        if self._proxy_connection_is_registered(connection):
            raise gen.Return((connection, queue))

        LOGGER.debug('The proxy connection for "%s" is not registered.',
                     report_name)

        self._deregister_browser(connection, queue)
        new_connection, new_queue = (
            yield self._register_browser(report_name, ws))
        raise gen.Return((new_connection, new_queue))

    def get_storage(self):
        """Get object that connects to online storage.

        NOTE: Even internal methods of Proxy should call this directly, since
        the cloud object is instantiated lazily in this method.

        Returns
        -------
        proxy.storage.AbstractCloudStorage
            The cloud object.

        """
        if self._storage is None:
            self._storage = Storage()
        return self._storage

    def _has_browser_connections(self, report_name):
        """Check whether any browsers are connected to this report name.

        Parameters
        ----------
        report_name : str
            The name of the report

        Returns
        -------
        boolean
            True if any browsers maintain connections to this report_name.

        """
        if report_name in self._connections:
            return self._connections[report_name].has_browser_connections()
        else:
            return False

    @gen.coroutine
    def _register_browser(self, report_name, ws):
        """Add a queue to the connection for the given report_name.

        Parameters
        ----------
        report_name : str
            The name of the report this is about.

        ws : WebSocket
            The websocket object.

        Returns
        -------
        ProxyConnection
        ReportQueue

        """
        self._received_browser_connection = True
        connection = self._connections[report_name]
        queue = connection.add_browser_queue()

        yield util.write_proto(
            ws,
            new_report_msg(
                connection.id, connection.cwd, connection.command_line,
                connection.source_file_path))

        LOGGER.debug(
            'Added new browser connection. '
            f'Id: {connection.id}, '
            f'Command line: {connection.command_line}')

        raise gen.Return((connection, queue))

    def _deregister_browser(self, connection, queue):
        """Remove queue from connection and close connection if necessary."""
        connection.remove_browser_queue(queue)
        LOGGER.debug('Removed the browser connection for "%s"', connection.name)
        self.schedule_potential_deregister_and_stop(connection)

    def _maybe_add_fs_observer(self, connection):
        """Start observing filesystem and store observer in self._fs_observers.

        Obeys config option proxy.watchFileSystem. If False, does not observe.

        Parameters
        ----------
        connection : ProxyConnection
            Connection object containing information about the folder to
            observe.

        """
        if not config.get_option('proxy.watchFileSystem'):
            return

        if self._keep_alive:
            LOGGER.debug(
                'Will not observe file system since keepAlive is True')
            return

        key = FSObserver.get_key(connection)
        observer = self._fs_observers.get(key)

        if observer is None:
            observer = FSObserver(connection, _on_fs_event)
            self._fs_observers[key] = observer
        else:
            observer.register_consumer(connection)

    def _remove_fs_observer(self, connection):
        """Stop observing filesystem.

        Parameters
        ----------
        connection : ProxyConnection
            Connection object containing information about the folder we should
            stop observing.

        """
        key = FSObserver.get_key(connection)
        observer = self._fs_observers.get(key)

        if observer is not None:
            observer.deregister_consumer(connection)
            if observer.is_closed():
                del self._fs_observers[key]


def stop_proxy_on_exception(is_coroutine=False):
    """Decorate WebSocketHandler callbacks to stop the proxy on exception."""
    def stop_proxy_decorator(callback):
        if is_coroutine:
            @functools.wraps(callback)
            @gen.coroutine
            def wrapped_coroutine(web_socket_handler, *args, **kwargs):
                try:
                    LOGGER.debug(
                        f'Running wrapped version of COROUTINE {callback}')
                    LOGGER.debug(f'About to yield {callback}')
                    rv = yield callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug(f'About to return {rv}')
                    raise gen.Return(rv)
                except gen.Return:
                    LOGGER.debug(f'Passing through COROUTINE return value:')
                    raise
                except Exception as e:
                    LOGGER.debug(
                        f'Caught a COROUTINE exception: "{e}" ({type(e)})')
                    traceback.print_exc()
                    web_socket_handler._proxy.stop()
                    LOGGER.debug('Stopped the proxy.')
                    raise
            return wrapped_coroutine

        else:
            @functools.wraps(callback)
            def wrapped_callback(web_socket_handler, *args, **kwargs):
                try:
                    return callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug(f'Running wrapped version of {callback}')
                except Exception as e:
                    LOGGER.debug(f'Caught an exception: "{e}" ({type(e)})')
                    traceback.print_exc()
                    web_socket_handler._proxy.stop()
                    LOGGER.debug('Stopped the proxy.')
                    raise
            return wrapped_callback

        return functools.wraps(callback)(wrapped_callback)

    return stop_proxy_decorator


class _HealthHandler(web.RequestHandler):
    def get(self):
        self.write('ok')

    def check_origin(self, origin):
        """Set up CORS."""
        return proxy_util.url_is_from_allowed_origins(origin)


def _print_urls(connection, autoCloseDelaySecs):
    external_url = connection.get_external_url()
    internal_url = connection.get_internal_url()

    if autoCloseDelaySecs != float('inf'):
        timeout_msg = f'within {int(autoCloseDelaySecs)} seconds'
    else:
        timeout_msg = ''

    if config.get_option('proxy.isRemote'):
        LOGGER.debug(
            f'External URL: {external_url}, Internal URL: {internal_url}')
    else:
        print(textwrap.dedent(f'''
            =============================================================
            Open one of the URLs below in your browser {timeout_msg}
            External URL: {external_url}
            Internal URL: {internal_url}
            =============================================================
        '''))


def _on_fs_event(observer, event):  # noqa: D401
    """Callback for FS events.

    Note: this will run in the Observer thread (created by the watchdog
    module).
    """
    LOGGER.debug(
        f'File system event: [{event.event_type}] {event.src_path}.')

    process_runner.run_outside_proxy_process(
        observer.command_line,
        observer.cwd,
        )
