# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import os
import signal
import sys
import tornado.ioloop
import urllib

from streamlit import config
from streamlit import util
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.Report import Report
from streamlit.ScriptRunner import ScriptRunner
from streamlit.Server import Server
import streamlit as st

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Wait for 1 second before opening a browser. This gives old tabs a chance to
# reconnect.
# This must be >= 2 * WebSocketConnection.ts#RECONNECT_WAIT_TIME_MS.
BROWSER_WAIT_TIMEOUT_SEC = 1


def _set_up_signal_handler(scriptrunner):
    LOGGER.debug('Setting up signal handler')

    def signal_handler(signal_number, stack_frame):
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


def _fix_sys_path(script_path):
    """Add the script's folder to the sys path.

    Python normally does this automatically, but since we exec the script
    ourselves we need to do it instead.
    """
    sys.path.insert(0, os.path.dirname(script_path))


def run(script_path):
    """Run a script in a separate thread and start a server for the report.

    This starts a blocking ioloop.

    Parameters
    ----------
    script_path : str

    """
    _fix_sys_path(script_path)

    ioloop = tornado.ioloop.IOLoop.current()
    report = Report(script_path, sys.argv)
    scriptrunner = ScriptRunner(report)

    _set_up_signal_handler(scriptrunner)

    # Schedule the server to start using the IO Loop on the main thread.
    server = Server(report, scriptrunner)
    ioloop.spawn_callback(server.loop_coroutine)

    def maybe_enqueue(msg):
        if not config.get_option('client.displayEnabled'):
            return False
        scriptrunner.maybe_handle_execution_control_request()
        server.enqueue(msg)
        return True

    # Somewhat hacky: create the root DeltaGenerator, and put it in the
    # Streamlit module.
    st._delta_generator = DeltaGenerator(maybe_enqueue)

    # Start the script in a separate thread, but do it from the ioloop so it
    # happens after the server starts.
    ioloop.spawn_callback(scriptrunner.spawn_script_thread)

    def maybe_open_browser():
        if config.get_option('proxy.isRemote'):
            # Don't open browser when in remote (headless) mode.
            return

        if server.browser_is_connected:
            # Don't auto-open browser if there's already a browser connected.
            # This can happen if there's an old tab repeatedly trying to
            # connect, and it happens to success before we launch the browser.
            return

        util.open_browser(report.get_url(host_ip='localhost'))

    # Schedule the browser to open using the IO Loop on the main thread, but
    # only if no other browser connects within 1s.
    ioloop.call_later(BROWSER_WAIT_TIMEOUT_SEC, maybe_open_browser)

    ioloop.start()
