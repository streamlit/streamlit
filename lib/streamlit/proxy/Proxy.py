# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""A proxy server between the Streamlit client and web browser.

Internally, the Proxy basically does bookkeeping for a set of ClientConnection
objects. A ClientConnection always has:

    - One ClientWebSocket connection to the client Python libs.
    - Zero or more BrowserWebSocket connections to a web browser.

Essentially, the ClientConnection stays open so long as any of those connections
do. When the final ClientConnection closes, then the whole proxy does too.
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
from streamlit.proxy import proxy_util
from streamlit.proxy.storage.S3Storage import S3Storage as Storage
from streamlit.proxy.ReportSession import ReportSession, ReportState
from streamlit.forward_msg_proto import new_report_msg, initialize_msg

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

if not config.get_option('global.developmentMode'):
    # Hide logs unless they're super important.
    # Example of stuff we don't care about: 404 about .js.map files.
    logging.getLogger('tornado.access').setLevel(logging.ERROR)
    logging.getLogger('tornado.application').setLevel(logging.ERROR)
    logging.getLogger('tornado.general').setLevel(logging.ERROR)


class Proxy(object):
    """The main base class for the streamlit server."""

    def __init__(self):
        """Proxy constructor."""
        # This table from report_name to ClientConnections stores all the
        # information about our connections. When the number of connections
        # drops to zero then the proxy shuts down.
        self._client_connections = dict()

        # Map of report_name->ReportSession.
        # The lifetime of a ReportSession object is the time during
        # which 1 or more browsers are looking at the report in question.
        self._report_sessions = dict()

        # This object represents a connection to an S3 bucket or other cloud
        # storage solution. It is instantiated lazily by calling
        # get_storage() which is why it starts off as null.
        self._storage = None

        # This becomes True when this Proxy is ready for a browser to connect
        # to it (meaning the HTTP and WebSocket endpoints are ready, and there
        # is at least one report registered)
        self.is_ready_for_browser_connection = False

        # How long to keep the proxy alive for, when there are no connections.
        self._auto_close_delay_secs = config.get_option(
            'proxy.autoCloseDelaySecs')

        self._report_expiration_secs = config.get_option(
            'proxy.reportExpirationSecs')

        self._keep_alive = (
            self._auto_close_delay_secs == float('inf') or
            self._report_expiration_secs == float('inf'))

        LOGGER.debug(
            'Creating proxy with self._connections: %s',
            id(self._client_connections))

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
            ('/healthz', _HealthHandler, dict(proxy=self)),
        ]

        if not config.get_option('proxy.useNode'):
            # If we're not using the node development server, then the proxy
            # will serve up the development pages.
            static_path = util.get_static_dir()
            LOGGER.debug('Serving static content from %s', static_path)

            routes.extend([
                (r"/()$", web.StaticFileHandler,
                    {'path': '%s/index.html' % static_path}),
                (r"/(.*)", web.StaticFileHandler,
                    {'path': '%s/' % static_path}),
            ])
        else:
            LOGGER.debug(
                'useNode == True, not serving static content from python.')

        app = web.Application(routes)
        port = config.get_option('proxy.port')

        http_server = HTTPServer(app)
        http_server.listen(port)

        LOGGER.debug('Proxy HTTP server for started on port %s', port)

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
                'Go to %s for debugging hints.', util.HELP_DOC)

    def stop(self):
        """Stop proxy.

        Allowing all current handler to exit normally.
        """
        LOGGER.debug('Stopping proxy')
        if not self._stopped:
            IOLoop.current().stop()

        # Close all our ReportObservers
        for observer in self._report_sessions.values():
            observer.close()
        self._report_sessions.clear()
        self._stopped = True

    def register_client_connection(self, client_connection):
        """Register a ClientConnection's report name
        so that browser connections can connect to the report.
        """
        LOGGER.debug('Registering proxy connection for "%s"',
                     client_connection.name)
        LOGGER.debug(
            'About to start registration: %s (%s)',
            list(self._client_connections.keys()), id(self._client_connections))

        # Open the browser and connect it to this report_name
        # (i.e. connection.name) if we don't have one open already.
        open_new_browser_connection = (
            not self._has_browser_connections(client_connection.name))

        self._client_connections[client_connection.name] = client_connection
        report_session = self._get_report_session(client_connection.name)
        if report_session:
            report_session.set_client_connection(client_connection)

        if open_new_browser_connection:
            if config.get_option('proxy.isRemote'):
                _print_urls(
                    client_connection,
                    self._auto_close_delay_secs + self._report_expiration_secs)
            else:
                url = client_connection.get_url(
                    config.get_option('browser.proxyAddress'))
                util.open_browser(url)

        self.is_ready_for_browser_connection = True

        # Clean up the connection we don't get an incoming connection.
        def connection_timeout():
            LOGGER.debug('In connection timeout for "%s".',
                         client_connection.name)
            client_connection.end_grace_period()
            self.schedule_potential_deregister_and_stop(client_connection)

        if not self._keep_alive:
            connection_timeout()

        LOGGER.debug(
            'Finished registering connection: %s (%s)',
            list(self._client_connections.keys()), id(self._client_connections))

    def schedule_potential_deregister_and_stop(self, client_connection):
        """Try to deregister proxy connection.

        Deregister ClientConnection so long as there aren't any open connection
        (client or browser), and the connection is no longer in its grace
        period.

        Parameters
        ----------
        client_connection : ClientConnection

        """
        def potentially_unregister():
            if not self._client_connection_is_registered(client_connection):
                return

            if not client_connection.can_be_deregistered():
                return

            LOGGER.debug('Deregistering connection')
            self._deregister_client_connection(client_connection)
            self.schedule_potential_stop()

        LOGGER.debug(
            'Will wait %ss before deregistering connection',
            self._report_expiration_secs)

        loop = IOLoop.current()
        loop.call_later(self._report_expiration_secs, potentially_unregister)

    def _deregister_client_connection(self, client_connection):
        """Deregister proxy connection irrespective of whether it's in use.

        Parameters
        ----------
        client_connection : ClientConnection
            The connection to deregister. It will be properly shutdown before
            deregistering.

        """
        del self._client_connections[client_connection.name]
        report_session = self._get_report_session(client_connection.name)
        if report_session:
            report_session.set_client_connection(None)

        LOGGER.debug('Got rid of connection %s', client_connection.name)
        LOGGER.debug('Total connections left: %s', len(self._client_connections))

    def _client_connection_is_registered(self, client_connection):
        """Return true if this connection is registered to its name."""
        return self._client_connections.get(client_connection.name, None) \
               is client_connection

    def schedule_potential_stop(self):
        """Stop proxy if no open connections and not in keepAlive mode."""
        if self._keep_alive:
            return

        def potentially_stop():
            LOGGER.debug(
                'Stopping if there are no more connections: ' +
                str(list(self._client_connections.keys())))

            if not self._client_connections:
                self.stop()

        LOGGER.debug(
            'Will check in %ss if there are no more connections: ',
            self._auto_close_delay_secs)
        loop = IOLoop.current()
        loop.call_later(self._auto_close_delay_secs, potentially_stop)

    @gen.coroutine
    def on_browser_connection_opened(self, ws):  # noqa: D401
        """Called when a browser connection is opened. Sends a
        NewConnection message to the browser and registers it to receive
        updates for the report it wants to connect to.

        Parameters
        ----------
        ws : BrowserWebSocket
            The BrowserWebSocket instance that just got opened.

        Returns
        -------
        (ClientConnection, ReportQueue)
            The new ClientConnection object which manages this connection to the
            proxy, as well as the queue this connection should write into.

        """

        existing_session = self._get_report_session(ws.report_name)
        if existing_session:
            report_state = existing_session.state
        else:
            client_connection = self._client_connections[ws.report_name]
            report_state = ReportState(
                run_on_save=self._run_on_save_default_value,
                report_is_running=client_connection is not None and client_connection.is_connected)

        # Send the Initialize message
        msg = initialize_msg(report_state)

        LOGGER.debug(
            'New browser connection:\n'
            '\tsharing_enabled=%s\n'
            '\tgather_usage_stats=%s\n'
            '\trun_on_save=%s',
            msg.initialize.sharing_enabled,
            msg.initialize.gather_usage_stats,
            msg.initialize.session_state.run_on_save)

        yield ws.write_proto(msg)

        # Register the browser with its report queue. This will
        # send its first NewReport message.
        connection, queue = \
            yield self._register_browser_with_report_queue(ws.report_name, ws)

        # Register the browser with the ReportSession so that it receives
        # messages about report state changes and events.
        session = self._get_report_session(ws.report_name,
                                           create_if_missing=True)
        session.register_browser(ws.key)
        session.state_changed.connect(ws.on_session_state_changed)
        session.on_report_changed.connect(ws.on_report_changed)
        session.on_report_was_manually_stopped.connect(
            ws.on_report_was_manually_stopped)

        raise gen.Return((connection, queue))

    def on_browser_connection_closed(self, ws, client_connection, queue):  # noqa: D401
        """Called when a browser connection is closed.

        Parameters
        ----------
        ws : BrowserWebSocket
            The BrowserWebSocket instance that was closed.
        client_connection : ClientConnection
            The ClientConnection for the browser connection that just closed.
        queue : ReportQueue
            The queue for the closed browser connection.

        """
        # Deregister from ReportSession
        report_name = client_connection.name
        session = self._get_report_session(report_name)
        if session is not None:
            session.state_changed.disconnect(ws.on_session_state_changed)
            session.deregister_browser(ws.key)
            self._maybe_close_report_session(report_name)

        # Deregister from ReportQueue
        self._deregister_browser_from_report_queue(client_connection, queue)

    @gen.coroutine
    def get_latest_connection_and_queue(  # noqa: D401
            self, report_name, ws, client_connection, queue):
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
        client_connection : ClientConnection
            The BrowserWebSocket's current ClientConnection
        queue : ReportQueue
            The BrowserWebSocket's current ReportQueue

        Returns
        -------
        ClientConnection
            The newly registered proxy connection.
        ReportQueue
            The corresponding newly registered queue.

        """
        # No need to change the connection or queue if the current one is still
        # registered.
        if self._client_connection_is_registered(client_connection):
            raise gen.Return((client_connection, queue))

        LOGGER.debug('The proxy connection for "%s" is not registered.',
                     report_name)

        self._deregister_browser_from_report_queue(client_connection, queue)
        new_connection, new_queue = (
            yield self._register_browser_with_report_queue(report_name, ws))
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
        if report_name in self._client_connections:
            return self._client_connections[report_name].has_browser_connections()
        else:
            return False

    @gen.coroutine
    def _register_browser_with_report_queue(self, report_name, ws):
        """Registers a browser with the queue for the given report_name.
        This is called once shortly after the browser makes its initial
        connection to the Proxy, and then again any time the report
        in question is re-run.

        Parameters
        ----------
        report_name : str
            The name of the report this is about.

        ws : BrowserWebSocket
            The websocket object.

        Returns
        -------
        (ClientConnection, ReportQueue)

        """
        self._received_browser_connection = True
        client_connection = self._client_connections[report_name]
        queue = client_connection.add_browser_queue()

        # Send the NewReport message
        yield ws.write_proto(new_report_msg(
            client_connection.id, client_connection.cwd,
            client_connection.command_line, client_connection.source_file_path))

        LOGGER.debug(
            'Added new browser connection. '
            'Id: %s, '
            'Command line: %s',
            client_connection.id, client_connection.command_line)

        raise gen.Return((client_connection, queue))

    def _deregister_browser_from_report_queue(self, client_connection, queue):
        """Remove queue from connection and close connection if necessary."""
        client_connection.remove_browser_queue(queue)
        LOGGER.debug('Removed the browser connection for "%s"',
                     client_connection.name)
        self.schedule_potential_deregister_and_stop(client_connection)

    def set_run_on_save(self, report_name, run_on_save):
        """Sets the run-on-save value for a given report. If no such
        report is active, this is a no-op.

        Parameters
        ----------
        report_name : str
            Name of the report

        run_on_save : bool
            Whether run-on-save should be enabled for the report
        """
        session = self._get_report_session(report_name)
        if session is None:
            LOGGER.debug('Cannot set run_on_save for non-existent report "%s"',
                         report_name)
        else:
            session.set_run_on_save(run_on_save)

    def stop_report(self, report_name):
        """Stops the current execution of the given report. If no such
        report is active, or if the report isn't currently running,
        this is a no-op.

        Parameters
        ----------
        report_name : str
            Name of the report
        """
        session = self._get_report_session(report_name)
        if session is None:
            LOGGER.debug('Cannot stop non-existent report "%s"', report_name)
        else:
            session.stop_report()

    @property
    def _run_on_save_default_value(self):
        """True if ReportSessions have run-on-save enabled by default"""
        return config.get_option('proxy.runOnSave')

    def _get_report_session(self, report_name, create_if_missing=False):
        """Returns the ReportSession for the given report name if it
        exists.

        Parameters
        ----------
        report_name : str
            The name of the report.

        create_if_missing : bool
            Create a new ReportSession if one for the given report_name
            doesn't already exist
        """
        session = self._report_sessions.get(report_name)
        if session is None and create_if_missing:
            client_connection = self._client_connections.get(report_name)
            if client_connection is None:
                raise RuntimeError(
                    'No proxy connection for report "%s"' % report_name)

            session = ReportSession(client_connection)
            session.set_run_on_save(self._run_on_save_default_value)

            self._report_sessions[report_name] = session
            LOGGER.debug('Created ReportSession for "%s"', report_name)

        return session

    def _maybe_close_report_session(self, report_name):
        """Closes the ReportSession for the given report_name if it has
        no browser listeners

        Parameters
        ----------
        report_name : str
            The name of the report
        """
        session = self._report_sessions.get(report_name)
        if session and not session.has_registered_browsers:
            if not session.has_registered_browsers:
                LOGGER.debug(
                    'Closing ReportSession "%s" with no registered browsers',
                    report_name)
                session.close()
                del self._report_sessions[report_name]


def stop_proxy_on_exception(is_coroutine=False):
    """Decorate WebSocketHandler callbacks to stop the proxy on exception."""
    def stop_proxy_decorator(callback):
        if is_coroutine:
            @functools.wraps(callback)
            @gen.coroutine
            def wrapped_coroutine(web_socket_handler, *args, **kwargs):
                try:
                    LOGGER.debug(
                        'Running wrapped version of COROUTINE %s', callback)
                    LOGGER.debug('About to yield %s', callback)
                    rv = yield callback(web_socket_handler, *args, **kwargs)
                    LOGGER.debug('About to return %s', rv)
                    raise gen.Return(rv)
                except gen.Return:
                    LOGGER.debug('Passing through COROUTINE return value')
                    raise
                except Exception as e:
                    LOGGER.debug(
                        'Caught a COROUTINE exception: "%(e)s" (%(type)s)',
                        {'e': e, 'type': type(e)})
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
                except Exception as e:
                    LOGGER.debug(
                        'Caught an exception: "%(e)s" (%(type)s)',
                        {'e': e, 'type': type(e)})
                    traceback.print_exc()
                    web_socket_handler._proxy.stop()
                    LOGGER.debug('Stopped the proxy.')
                    raise
            return wrapped_callback

    return stop_proxy_decorator


class _HealthHandler(web.RequestHandler):
    def initialize(self, proxy):
        self._proxy = proxy

    def get(self):
        if self._proxy.is_ready_for_browser_connection:
            self.write('ok')
        else:
            # 503 is SERVICE_UNAVAILABLE
            self.set_status(503)
            self.write('notready')

    def check_origin(self, origin):
        """Set up CORS."""
        return proxy_util.url_is_from_allowed_origins(origin)


def _print_urls(connection, wait_secs):
    if wait_secs != float('inf'):
        timeout_msg = 'within %s seconds' % wait_secs
    else:
        timeout_msg = ''

    if config.is_manually_set('browser.proxyAddress'):
        url = connection.get_url(
            config.get_option('browser.proxyAddress'))

        LOGGER.info(textwrap.dedent('''
            ════════════════════════════════════════════════════════════
            Open the URL below in your browser {timeout_msg}
            REPORT URL: {url}
            ════════════════════════════════════════════════════════════
        '''), {'url': url, 'timeout_msg': timeout_msg})

    else:
        external_url = connection.get_url(util.get_external_ip())
        internal_url = connection.get_url(util.get_internal_ip())

        LOGGER.info(textwrap.dedent('''
            ════════════════════════════════════════════════════════════
            Open one of the URLs below in your browser {timeout_msg}
            EXTERNAL REPORT URL: {external_url}
            INTERNAL REPORT URL: {internal_url}
            ════════════════════════════════════════════════════════════
        '''), {'external_url': external_url, 'internal_url': internal_url})
