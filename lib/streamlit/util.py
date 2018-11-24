# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A bunch of useful utilites."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# flake8: noqa
import base58
import contextlib
import functools
import os
import pwd
import threading
import uuid


STREAMLIT_ROOT_DIRECTORY = '.streamlit'

def _decode_ascii(str):
    """Decodes a string as ascii."""
    return str.decode('ascii')

@contextlib.contextmanager
def streamlit_read(path, binary=False):
    f"""Opens a context to read this file relative to the streamlit path.

    For example:

    with read('foo.txt') as foo:
        ...

    opens the file `{STREAMLIT_ROOT_DIRECTORY}/foo.txt`

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """
    mode = 'r'
    if binary:
        mode += 'b'
    with open(os.path.join(STREAMLIT_ROOT_DIRECTORY, path), mode) as handle:
        yield handle

@contextlib.contextmanager
def streamlit_write(path, binary=False):
    r"""
    Opens a file for writing within the streamlit path, and
    ensuring that the path exists. For example:

        with open_ensuring_path('foo/bar.txt') as bar:
            ...

    opens the file {STREAMLIT_ROOT_DIRECTORY}/foo/bar.txt for writing,
    creating any necessary directories along the way.

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """
    mode = 'w'
    if binary:
        mode += 'b'
    path = os.path.join(STREAMLIT_ROOT_DIRECTORY, path)
    directory = os.path.split(path)[0]
    if not os.path.exists(directory):
        os.makedirs(directory)
    with open(path, mode) as handle:
        yield handle

def escape_markdown(raw_string):
    """Returns a new string which escapes all markdown metacharacters.

    Args
    ----
    raw_string : str
        A string, possibly with markdown metacharacters, e.g. "1 * 2"

    Returns
    -------
    A string with all metacharacters escaped.

    Examples
    --------
    ::
        escape_markdown("1 * 2") -> "1 \* 2"
    """
    metacharacters = ['\\', '*', '-', '=', '`', '!', '#', '|']
    result = raw_string
    for character in metacharacters:
        result = result.replace(character, '\\' + character)
    return result

def get_static_dir():
    dirname = os.path.dirname(os.path.normpath(__file__))
    return os.path.normpath(os.path.join(dirname, 'static'))


def memoize(func):
    """Decorator to memoize the result of a no-args func."""
    result = []
    @functools.wraps(func)
    def wrapped_func():
        if not result:
            result.append(func())
        return result[0]
    return wrapped_func

def write_proto(ws, msg):
    """Writes a proto to a websocket.

    Parameters
    ----------
    ws : WebSocket
    msg : Proto

    Returns
    -------
    Future
        See tornado.websocket.websocket_connect. This returns a Future whose
        result is a WebSocketClientConnection.
    """
    return ws.write_message(msg.SerializeToString(), binary=True)


def build_report_id():
    """Randomly generate a report ID."""
    return base58.b58encode(uuid.uuid4().bytes).decode("utf-8")


# Magic strings used to mark exceptions that have been handled by Streamlit's
# excepthook. These string should be printed to stderr.
EXCEPTHOOK_IDENTIFIER_STR = (
    'Streamlit has caught the following unhandled exception...')
