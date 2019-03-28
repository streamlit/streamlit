# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import signal
import tornado.ioloop
import urllib

from streamlit import config
from streamlit import util
from streamlit.scriptrunner import ScriptRunner
from streamlit.server import Server

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


def _set_up_signal_handler():
    # Reimport things we'll need in the closure below, or they get removed.
    # XXX TODO see if this is still true.
    import signal
    from streamlit.scriptrunner import ScriptRunner

    LOGGER.debug('Setting up signal handler')

    def signal_handler(signal_number, stack_frame):
        scriptrunner = ScriptRunner.get_instance()
        script_was_running = scriptrunner.is_running()
        scriptrunner.request_stop()

        # If the script is running, users can use Ctrl-C to stop it, and then
        # another Ctrl-C to stop the server. If not running, Ctrl-C just stops
        # the server.
        if not script_was_running:
            tornado.ioloop.IOLoop.current().stop()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGQUIT, signal_handler)


def _get_browser_address_bar_port():
    """Get the report URL that will be shown in the browser's address bar.

    That is, this is the port where static assets will be served from. In dev,
    this is different from the URL that will be used to connect to the
    proxy-browser websocket.

    """
    if config.get_option('proxy.useNode'):
        return 3000
    return config.get_option('browser.proxyPort')


def _get_url(script_path):
    """Get the URL for this report, for access from this machine.

    Parameters
    ----------
    script_path : str

    Returns
    -------
    str
        The URL.

    """
    # XXX Why do we need the ?name= param at this point?
    port = _get_browser_address_bar_port()
    quoted_path = urllib.parse.quote_plus(script_path)
    return ('http://localhost:%(port)s/?name=%(quoted_path)s' % {
        'port': port,
        'quoted_path': quoted_path,
    })


def run(script_path):
    """Run a script in a separate thread and start a server for the report.

    This starts a blocking ioloop.

    Parameters
    ----------
    script_path : str

    """
    _set_up_signal_handler()

    ioloop = tornado.ioloop.IOLoop.current()
    server = Server.get_instance()
    ioloop.spawn_callback(server.loop_coroutine)

    scriptrunner = ScriptRunner.get_instance()
    scriptrunner.file_path = script_path
    scriptrunner.spawn_script_thread()

    util.open_browser(_get_url(script_path))

    ioloop.start()
