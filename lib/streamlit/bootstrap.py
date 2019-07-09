# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import os
import signal
import sys

import click
import tornado.ioloop

from streamlit import config
from streamlit import util
from streamlit.Report import Report
from streamlit.Server import Server

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Wait for 1 second before opening a browser. This gives old tabs a chance to
# reconnect.
# This must be >= 2 * WebSocketConnection.ts#RECONNECT_WAIT_TIME_MS.
BROWSER_WAIT_TIMEOUT_SEC = 1


def _set_up_signal_handler():
    LOGGER.debug('Setting up signal handler')

    def signal_handler(signal_number, stack_frame):
        # The server will shut down its threads and stop the ioloop
        Server.get_current().stop()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGQUIT, signal_handler)


def _fix_sys_path(script_path):
    """Add the script's folder to the sys path.

    Python normally does this automatically, but since we exec the script
    ourselves we need to do it instead.
    """
    sys.path.insert(0, os.path.dirname(script_path))


def _on_server_start(server):
    _print_url()

    def maybe_open_browser():
        if config.get_option('server.headless'):
            # Don't open browser when in headless mode.
            return

        if server.browser_is_connected:
            # Don't auto-open browser if there's already a browser connected.
            # This can happen if there's an old tab repeatedly trying to
            # connect, and it happens to success before we launch the browser.
            return

        if config.is_manually_set('browser.serverAddress'):
            addr = config.get_option('browser.serverAddress')
        else:
            addr = 'localhost'

        util.open_browser(Report.get_url(addr))

    # Schedule the browser to open using the IO Loop on the main thread, but
    # only if no other browser connects within 1s.
    ioloop = tornado.ioloop.IOLoop.current()
    ioloop.call_later(BROWSER_WAIT_TIMEOUT_SEC, maybe_open_browser)


def _print_url():
    title_message = 'You can now view your Streamlit report in your browser.'
    named_urls = []

    if config.is_manually_set('browser.serverAddress'):
        named_urls = [
            ('URL',
                Report.get_url(config.get_option('browser.serverAddress'))),
        ]

    elif config.get_option('server.headless'):
        named_urls = [
            ('Network URL', Report.get_url(util.get_internal_ip())),
            ('External URL', Report.get_url(util.get_external_ip())),
        ]

    else:
        named_urls = [
            ('Local URL', Report.get_url('localhost')),
            ('Network URL', Report.get_url(util.get_internal_ip())),
        ]

    click.secho('')
    click.secho('  %s' % title_message, fg='green')
    click.secho('')

    for url_name, url in named_urls:
        util.print_url(url_name, url)

    click.secho('')


def run(script_path):
    """Run a script in a separate thread and start a server for the report.

    This starts a blocking ioloop.

    Parameters
    ----------
    script_path : str

    """
    _fix_sys_path(script_path)

    # Install a signal handler that will shut down the ioloop
    # and close all our threads
    _set_up_signal_handler()

    # Schedule the server to start using the IO Loop on the main thread.
    server = Server(
        script_path, sys.argv, on_server_start_callback=_on_server_start)

    server.add_preheated_report_context()

    ioloop = tornado.ioloop.IOLoop.current()
    ioloop.spawn_callback(server.loop_coroutine)

    ioloop.start()
