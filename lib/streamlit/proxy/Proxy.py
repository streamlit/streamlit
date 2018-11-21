# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A proxy server between the Streamlit libs and web client.

Internally, the Proxy basically does bookkeeping for a set of ProxyConnection
objects. A ProxyConnection always has:

    - One "local" connection to the python libs.
    - Zero or more "client" connections to the web client.

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

from streamlit import config
from streamlit import S3Connection
from streamlit.util import get_static_dir, write_proto

from streamlit.streamlit_msg_proto import new_report_msg

from tornado import gen, web
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
import functools
import os
import platform
import socket
import textwrap
import traceback
import urllib
import webbrowser

from streamlit.proxy.FSObserver import FSObserver
from streamlit.proxy import process_runner

from streamlit.logger import get_logger
LOGGER = get_logger()

AWS_CHECK_IP = 'http://checkip.amazonaws.com'
HELP_DOC = 'http://streamlit.io/docs/help/'


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
        # get_cloud_storage() which is why it starts off as null.
        self._cloud_storage = None

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

        # We have to import these in here to break a circular import reference
        # issue in Python 2.7.
        from streamlit.proxy import LocalWebSocket, BrowserWebSocket

        # Set up HTTP routes
        routes = [
            # Local connection to stream a new report.
            ('/new/(.*)/(.*)', LocalWebSocket, dict(proxy=self)),

            # Outgoing endpoint to get the latest report.
            ('/stream/(.*)', BrowserWebSocket, dict(proxy=self)),

            ('/healthz', HealthHandler),
        ]
        if not config.get_option('proxy.useNode'):
            # If we're not using the node development server, then the proxy
            # will serve up the development pages.
            static_path = get_static_dir()
            LOGGER.info(f'Serving static content from {static_path}')

            routes.extend([
                (r"/()$", web.StaticFileHandler, {'path': f'{static_path}/index.html'}),
                (r"/(.*)", web.StaticFileHandler, {'path': f'{static_path}/'}),
            ])
        else:
            LOGGER.info('useNode == True, not serving static content from python.')
        self._app = web.Application(routes)

        # Attach an http server
        port = config.get_option('proxy.port')
        http_server = HTTPServer(self._app)
        http_server.listen(port)
        LOGGER.info('Proxy http server started on port {}'.format(port))

        # Remember whether we've seen any client connections so that we can
        # display a helpful warming message if the proxy closed without having
        # received any connections.
        self._received_client_connection = False

        # Avoids an exception by guarding against twice stopping the event loop.
        self._stopped = False

    def run_app(self):
        """Run web app."""
        LOGGER.debug('About to start the proxy.')
        IOLoop.current().start()
        LOGGER.debug('IOLoop closed.')

        # Give the user a helpful hint if no connection was received.
        headless = config.get_option('proxy.isRemote')
        if headless and not self._received_client_connection:
            print('Connection timeout to proxy.')
            print('Did you try to connect and nothing happened? '
                  f'Please go to {HELP_DOC} for debugging hints.')

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

        So that client connections can connect to it.
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
            _launch_web_client(connection.name, self._auto_close_delay_secs)

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
        (local or client), and the connection is no longer in its grace period.

        Parameters
        ----------
        connection : ProxyConnection

        """

        def potentially_unregister():
            if not self.proxy_connection_is_registered(connection):
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

    def proxy_connection_is_registered(self, connection):
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
            f'Will check in {self._auto_close_delay_secs}s if there are no more '
            'connections: ')
        loop = IOLoop.current()
        loop.call_later(self._auto_close_delay_secs, potentially_stop)

    @gen.coroutine
    def on_client_opened(self, report_name, ws):  # noqa: D401
        """Called when a client connection is opened.

        Parameters
        ----------
        report_name : str
            The name of the report the client connection is for.
        ws : BrowserWebSocket
            The BrowserWebSocket instance that just got opened.

        Returns
        -------
        ProxyConnection
        ReportQueue

        """
        connection, queue = yield self._add_client(report_name, ws)
        self._maybe_add_fs_observer(connection)
        raise gen.Return((connection, queue))

    def on_client_closed(self, connection, queue):  # noqa: D401
        """Called when a client connection is closed.

        Parameters
        ----------
        connection : ProxyConnection
            The connection object for the client that just got closed.
        queue : ReportQueue
            The queue for the closed client.

        """
        self._remove_fs_observer(connection)
        self._remove_client(connection, queue)

    @gen.coroutine
    def on_client_waiting_for_proxy_conn(  # noqa: D401
            self, report_name, ws, old_connection, old_queue):
        """Called when a client detects it has no corresponding ProxyConnection.

        Parameters
        ----------
        report_name : str
            The name of the report the client connection is for.
        ws : BrowserWebSocket
            The BrowserWebSocket instance that just got opened.
        connection : ProxyConnection
            The connection object that just got closed.
        queue : ReportQueue
            The client queue corresponding to the closed connection.

        Returns
        -------
        ProxyConnection
        ReportQueue

        """
        self._remove_client(old_connection, old_queue)
        new_connection, new_queue = (
            yield self._add_client(report_name, ws))
        raise gen.Return((new_connection, new_queue))

    def get_cloud_storage(self):
        """Get object that connects to online storage.

        See `S3Connection.py` for an example.

        NOTE: Even internal methods of Proxy should call this directly, since
        the cloud object is instantiated lazily in this method.

        Returns
        -------
        S3Connection.Cloud
            The cloud object.
        """
        if self._cloud_storage is None:
            self._cloud_storage = S3Connection.S3()
        return self._cloud_storage

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
    def _add_client(self, report_name, ws):
        """Add a queue to the connection for the given report_name.


        ws
            The websocket object.

        Returns
        -------
        ProxyConnection
        ReportQueue

        """
        self._received_client_connection = True
        connection = self._connections[report_name]
        queue = connection.add_client_queue()

        yield write_proto(
            ws,
            new_report_msg(
                connection.id, connection.cwd, connection.command_line,
                connection.source_file_path))

        LOGGER.debug(
            'Added new browser connection. '
            f'Id: {connection.id}, '
            f'Command line: {connection.command_line}')

        raise gen.Return((connection, queue))

    def _remove_client(self, connection, queue):
        """Remove queue from connection and close connection if necessary."""
        connection.remove_client_queue(queue)
        LOGGER.debug('Removed the browser connection for "%s"', connection.name)
        self.schedule_potential_deregister_and_stop(connection)

    def _maybe_add_fs_observer(self, connection):
        """Start observing filesystem and store observer in local map.

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
            LOGGER.info(
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
                    LOGGER.debug(f'Running wrapped version of COROUTINE {callback}')
                    LOGGER.debug(f'About to yield {callback}')
                    rv = yield callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug(f'About to return {rv}')
                    raise gen.Return(rv)
                except gen.Return:
                    LOGGER.debug(f'Passing through COROUTINE return value:')
                    raise
                except Exception as e:
                    LOGGER.debug(f'Caught a COROUTINE exception: "{e}" ({type(e)})')
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


class HealthHandler(web.RequestHandler):
    def get(self):
        self.write('ok')


def _print_remote_url(port, quoted_name, autoCloseDelaySecs):
    external_ip = config.get_option('proxy.externalIP')
    lan_ip = None

    if external_ip:
        LOGGER.debug(f'proxy.externalIP set to {external_ip}')
    else:
        print('proxy.externalIP not set, attempting to autodetect IP')
        external_ip = _get_external_ip()
        lan_ip = _get_lan_ip()

    if external_ip is None and lan_ip is None:
        print('Did not auto detect external ip. Please go to '
              f'{HELP_DOC} for debugging hints.')
        return

    external_url = _get_report_url(external_ip, port, quoted_name)
    lan_url = _get_report_url(lan_ip, port, quoted_name)

    if autoCloseDelaySecs != float('inf'):
        timeout_msg = f'within {int(autoCloseDelaySecs)} seconds'
    else:
        timeout_msg = ''

    if config.get_option('proxy.isRemote'):
        LOGGER.debug(f'External URL: {external_url}, Internal URL: {lan_url}')
    else:
        print(textwrap.dedent(f'''
            =============================================================
            Open one of the URLs below in your browser {timeout_msg}
            External URL: {external_url}
            Internal URL: {lan_url}
            =============================================================
        '''))


def _launch_web_client(name, autoCloseDelaySecs):
    """Launch a web browser to connect to the proxy to get the named report.

    Parameters
    ----------
    name : str
        The name of the report to which the web browser should connect.
    autoCloseDelaySecs : float
        Time the proxy will wait before closing, when there are no more
        connections.

    """
    if config.get_option('proxy.useNode'):
        # If changing this, also change frontend/src/baseconsts.js
        host, port = 'localhost', '3000'
    else:
        host = config.get_option('proxy.server')
        port = config.get_option('proxy.port')
    quoted_name = urllib.parse.quote_plus(name)
    url = 'http://{}:{}/?name={}'.format(
        host, port, quoted_name)

    headless = config.get_option('proxy.isRemote')
    LOGGER.debug(f'headless = {headless}')
    if headless:
        _print_remote_url(port, quoted_name, autoCloseDelaySecs)
    else:
        webbrowser.open(url)


def _on_fs_event(observer, event):  # noqa: D401
    """Callback for FS events.

    Note: this will run in the Observer thread (created by the watchdog
    module).
    """
    LOGGER.info(
        f'File system event: [{event.event_type}] {event.src_path}.')

    process_runner.run_outside_proxy_process(
        observer.command_line,
        observer.cwd,
        )


def _get_external_ip():
    """Get the *external* IP address of the current machine.

    Returns
    -------
    string
        The external IPv4 address of the current machine.

    """
    try:
        response = urllib.request.urlopen(AWS_CHECK_IP, timeout=5).read()
        external_ip = response.decode('utf-8').strip()
    except (urllib.URLError, RuntimeError) as e:
        LOGGER.error(f'Error connecting to {AWS_CHECK_IP}: {e}')
        external_ip = None

    return external_ip


def _get_lan_ip():
    """Get the *local* IP address of the current machine.

    From: https://stackoverflow.com/a/28950776

    Returns
    -------
    string
        The local IPv4 address of the current machine.

    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't even have to be reachable
        s.connect(('8.8.8.8', 1))
        lan_ip = s.getsockname()[0]
    except Exception:
        lan_ip = '127.0.0.1'
    finally:
        s.close()
    return lan_ip


def _get_report_url(host, port, name):
    """Return the URL of report defined by (host, port, name).

    Parameters
    ----------
    host : str
        The hostname or IP address of the current machine.
    port : int
        The port where Streamlit is running.
    name : str
        The name of the report.

    Returns
    -------
    string
        The remote IPv4 address.

    """
    if host is None:
        return 'Unable to detect'
    return 'http://{}:{}/?name={}'.format(host, port, name)
