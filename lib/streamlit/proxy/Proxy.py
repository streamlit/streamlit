# -*- coding: future_fstrings -*-

"""A proxy server between the Streamlit libs and web client.

Internally, the Proxy basically does bookkeeping for a set of ProxyConnection
objects. A ProxyConnection always has:

    - One "local" connection to the python libs.
    - Zero or more "client" connections to the web client.

Essentially, the ProxyConnection stays open so long as any of those connections
do. When the final ProxyConnection closes, then the whole proxy does too.

To ensure the proxy closes, a short timeout is launched for each connection
which closes the proxy if no connections were established.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import config
from streamlit import protobuf
from streamlit.S3Connection import S3Connection
from streamlit.logger import get_logger
from streamlit.proxy import ClientWebSocket, LocalWebSocket
# from streamlit.streamlit_msg_proto import new_report_msg
# from streamlit.streamlit_msg_proto import streamlit_msg_iter
# from streamlit.proxy import ProxyConnection

from tornado import gen, web
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop

LOGGER = get_logger()

def _stop_proxy_on_exception(coroutine):
    """Coroutine decorator to stop proxy on exception."""
    @gen.coroutine
    def wrapped_coroutine(proxy, *args, **kwargs):
        try:
            a = yield coroutine(proxy, *args, **kwargs)
            raise gen.Return(a)
        except:
            proxy.stop()
            raise
    wrapped_coroutine.__name__ = coroutine.__name__
    wrapped_coroutine.__doc__ = coroutine.__doc__
    return wrapped_coroutine


class Proxy(object):
    """The main base class for the streamlit server."""

    def __init__(self):
        """Proxy constructor."""
        self._connections = {}

        routes = [
            # # Local connection to stream a new report.
            ('/new/(.*)/(.*)', LocalWebSocket, dict(connections=self._connections)),

            # Outgoing endpoint to get the latest report.
            ('/stream/(.*)', ClientWebSocket, dict(connections=self._connections)),
        ]
        '''
        # Client connection (serves up index.html)
        web.get('/', self._client_html_handler),
        '''

        # If we're not using the node development server, then the proxy
        # will serve up the development pages.
        if not config.get_option('proxy.useNode'):
            static_path = config.get_path('proxy.staticRoot')
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

        # Avoids an exception by guarding against twice stopping the event loop.
        self._stopped = False

        # This table from names to ProxyConnections stores all the information
        # about our connections. When the number of connections drops to zero,
        # then the proxy shuts down.
        self._connections = dict()  # use instead of {} for 2/3 compatibility

        # Initialized things that the proxy will need to do cloud things.
        self._cloud = None  # S3Connection()

    def run_app(self):
        """Run web app."""
        '''
        port = config.get_option('proxy.port')
        web.run_app(self._app, port=port)
        '''
        LOGGER.debug('About to start the proxy.')
        IOLoop.current().start()
        LOGGER.debug('Just started the proxy.')

    def stop(self):
        """Stop proxy.

        Allowing all current handler to exit normally.
        """
        if not self._stopped:
            IOLoop.current().close()
        self._stopped = True

    '''
    @_stop_proxy_on_exception
    async def _client_html_handler(self, request):
        static_root = config.get_path('proxy.staticRoot')
        return web.FileResponse(os.path.join(static_root, 'index.html'))
    '''

    def _register(self, connection):
        """Register this connection's name.

        So that client connections can connect to it.
        """
        # Register the connection and launch a web client if this is a new name.
        new_name = connection.name not in self._connections
        self._connections[connection.name] = connection
        if new_name:
            self._lauch_web_client(connection.name)
            # self._cloud.create(connection.name)

        # Clean up the connection we don't get an incoming connection.
        def connection_timeout():
            connection.end_grace_period()
            self._try_to_deregister(connection)
            self._potentially_stop_proxy()
        timeout_secs = config.get_option('proxy.waitForConnectionSecs')
        loop = asyncst.get_event_loop()
        loop.call_later(timeout_secs, connection_timeout)

    def _try_to_deregister(self, connection):
        """Try to deregister proxy connection.

        Deregister this ProxyConnection so long as there aren't any open
        connection (local or client), and the connection is no longer in its
        grace period.
        """
        if self._is_registered(connection) and connection.can_be_deregistered():
            del self._connections[connection.name]

    def _is_registered(self, connection):
        """Return true if this connection is registered to its name."""
        return self._connections.get(connection.name, None) is connection

    '''
    async def _add_client(self, report_name, ws):
        """Adds a queue to the connection for the given report_name."""
        connection = self._connections[report_name]
        queue = connection.add_client_queue()
        await new_report_msg(connection.id, ws)
        return (connection, queue)
    '''

    def _remove_client(self, connection, queue):
        """Remove queue from connection and close connection if necessary."""
        connection.remove_client_queue(queue)
        self._try_to_deregister(connection)
        self._potentially_stop_proxy()

    def _potentially_stop_proxy(self):
        """Stop proxy if no open connections."""
        if not self._connections:
            self.stop()

    '''
    async def _handle_backend_msg(self, payload, connection, ws):
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            command  = backend_msg.command
            if command == protobuf.BackMsg.Command.Value('HELP'):
                os.system('python -m streamlit help &')
            elif command == protobuf.BackMsg.Command.Value('CLOUD_UPLOAD'):
                await self._save_cloud(connection, ws)
            else:
                print("no handler for",
                    protobuf.BackMsg.Command.Name(backend_msg.command))
        except Exception as e:
            print(f'Cannot parse binary message: {e}')

    async def _save_cloud(self, connection, ws):
        """Saves a serialized version of this report's deltas to the cloud."""
        # Indicate that the save is starting.
        progress_msg = protobuf.ForwardMsg()
        progress_msg.upload_report_progress = 100
        await ws.send_bytes(progress_msg.SerializeToString())

        # COMMENTED OUT FOR THIAGO (becuase he doesn't have AWS creds)
        report = connection.get_report_proto()
        print(f'Saving report of size {len(report.SerializeToString())} and type {type(report.SerializeToString())}')  # noqa: E501
        url = await self._cloud.upload_report(connection.id, report)

        # Pretend to upload something.
        await asyncst.sleep(3.0)
        url = 'https://s3-us-west-2.amazonaws.com/streamlit-test10/streamlit-static/0.9.0-b5a7d29ec8d0469961e5e5f050944dd4/index.html?id=90a3ef64-7a67-4f90-88c9-8161934af74a'  # noqa: E501

        # Indicate that the save is done.
        progress_msg.Clear()
        progress_msg.report_uploaded = url
        await ws.send_bytes(progress_msg.SerializeToString())
    '''
