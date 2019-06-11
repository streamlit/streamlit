# Copyright 2018 Streamlit Inc. All rights reserved.

"""A bunch of useful utilities."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# flake8: noqa
import contextlib
import errno
import functools
import os
import platform
import re
import socket
import subprocess
import sys
import threading
import urllib
try:
    import urllib.request  # for Python3
except ImportError:
    pass

import click

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


STREAMLIT_ROOT_DIRECTORY = '.streamlit'

# Magic strings used to mark exceptions that have been handled by Streamlit's
# excepthook. These string should be printed to stderr.
EXCEPTHOOK_IDENTIFIER_STR = (
    'Streamlit has caught the following unhandled exception...')


# URL for checking the current machine's external IP address.
_AWS_CHECK_IP = 'http://checkip.amazonaws.com'


# URL of Streamlit's help page.
HELP_DOC = 'https://streamlit.io/secret/docs/'


def _decode_ascii(string):
    """Decodes a string as ascii."""
    return string.decode('ascii')


@contextlib.contextmanager
def streamlit_read(path, binary=False):
    """Opens a context to read this file relative to the streamlit path.

    For example:

    with streamlit_read('foo.txt') as foo:
        ...

    opens the file `%s/foo.txt`

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """ % STREAMLIT_ROOT_DIRECTORY
    filename = get_streamlit_file_path(path)
    if os.stat(filename).st_size == 0:
        raise Error('Read zero byte file: "%s"' % filename)

    mode = 'r'
    if binary:
        mode += 'b'
    with open(os.path.join(STREAMLIT_ROOT_DIRECTORY, path), mode) as handle:
        yield handle


@contextlib.contextmanager
def streamlit_write(path, binary=False):
    """
    Opens a file for writing within the streamlit path, and
    ensuring that the path exists. For example:

        with streamlit_write('foo/bar.txt') as bar:
            ...

    opens the file %s/foo/bar.txt for writing,
    creating any necessary directories along the way.

    path   - the path to write to (within the streamlit directory)
    binary - set to True for binary IO
    """ % STREAMLIT_ROOT_DIRECTORY
    mode = 'w'
    if binary:
        mode += 'b'
    path = get_streamlit_file_path(path)
    try:
        with open(path, mode) as handle:
            yield handle
    except OSError as e:
        msg = ['Unable to write file: %s' % os.path.abspath(path)]
        if e.errno == errno.EINVAL and platform.system() == 'Darwin':
            msg.append('Python is limited to files below 2GB on OSX. '
                       'See https://bugs.python.org/issue24658')
        raise Error('\n'.join(msg))


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
        escape_markdown("1 * 2") -> "1 \\* 2"
    """
    metacharacters = ['\\', '*', '-', '=', '`', '!', '#', '|']
    result = raw_string
    for character in metacharacters:
        result = result.replace(character, '\\' + character)
    return result


def get_static_dir():
    """Get the folder where static HTML/JS/CSS files live."""
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


def _make_blocking_http_get(url, timeout=5):
    try:
        return urllib.request.urlopen(url, timeout=timeout).read()
    except Exception:
        return None


_external_ip = None


def get_external_ip():
    """Get the *external* IP address of the current machine.

    Returns
    -------
    string
        The external IPv4 address of the current machine.

    """
    global _external_ip

    if _external_ip is not None:
        return _external_ip

    response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)

    if response is None:
        LOGGER.warning(
            'Did not auto detect external IP.\n'
            'Please go to %s for debugging hints.', HELP_DOC)
    else:
        _external_ip = response.decode('utf-8').strip()

    return _external_ip


_internal_ip = None


def get_internal_ip():
    """Get the *local* IP address of the current machine.

    From: https://stackoverflow.com/a/28950776

    Returns
    -------
    string
        The local IPv4 address of the current machine.

    """
    global _internal_ip

    if _internal_ip is not None:
        return _internal_ip

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't even have to be reachable
        s.connect(('8.8.8.8', 1))
        _internal_ip = s.getsockname()[0]
    except Exception:
        _internal_ip = '127.0.0.1'
    finally:
        s.close()

    return _internal_ip


def open_browser(url):
    """Open a web browser pointing to a given URL.

    We use this function instead of Python's `webbrowser` module because this
    way we can capture stdout/stderr to avoid polluting the terminal with the
    browser's messages. For example, Chrome always prints things like "Created
    new window in existing browser session", and those get on the user's way.

    url : str
        The URL. Must include the protocol.

    """

    system = platform.system()

    if system == 'Linux':
        cmd = ['xdg-open', url]
    elif system == 'Darwin':
        cmd = ['open', url]
    elif system == 'Windows':
        # Windows has a few bugs.
        # * os.devnull doesnt exist so the open command below fails
        # * subprocess doesnt actually pop up the browser even though
        #   'start url' works from the command prompt
        # * tornado for whatever reason doesnt map / to /index.html and
        #   you get a 404.
        data = urllib.parse.urlsplit(url)
        (scheme, netloc, path, query, fragment) = data
        if re.match(r'^/$', path):
            path = '/index.html'
        url = urllib.parse.urlunsplit((scheme, netloc, path, query, fragment))
        import webbrowser
        webbrowser.open(url)
        return
    else:
        raise Error('Cannot open browser in platform "%s"' % system)

    with open(os.devnull, 'w') as devnull:
        subprocess.Popen(cmd, stdout=devnull, stderr=subprocess.STDOUT)


def is_type(obj, fqn_type_str):
    """Check type without importing expensive modules.

    Parameters
    ----------
    obj : any
        The object to type-check.
    fqn_type_str : str
        The fully-qualified type string.

    Example
    -------

    To check whether something is a Matplotlib Figure without importing
    matplotlib, use:

    >>> is_type(foo, 'matplotlib.figure.Figure')

    """
    the_type = type(obj)
    module = the_type.__module__
    name = the_type.__name__
    return fqn_type_str == '%s.%s' % (module, name)


class Error(Exception):
    pass


def is_pex():
    """Return if streamlit running in pex.

    Pex modifies sys.path so the pex file is the first path and that's
    how we determine we're running in the pex file.
    """
    if re.match(r'.*pex$', sys.path[0]):
        return True
    return False


def is_altair_chart(obj):
    """True if input looks like an Altair chart."""
    return (
        is_type(obj, 'altair.vegalite.v2.api.Chart') or
        is_type(obj, 'altair.vegalite.v3.api.Chart'))


def is_keras_model(obj):
    """True if input looks like a Keras model."""
    return (
        is_type(obj, 'keras.engine.sequential.Sequential') or
        is_type(obj, 'keras.engine.training.Model') or
        is_type(obj, 'tensorflow.python.keras.engine.sequential.Sequential') or
        is_type(obj, 'tensorflow.python.keras.engine.training.Model'))


def is_plotly_chart(obj):
    """True if input looks like a Plotly chart."""
    return (
        is_type(obj, 'plotly.graph_objs._figure.Figure') or
        _is_list_of_plotly_objs(obj) or
        _is_probably_plotly_dict(obj)
    )


def is_graphviz_chart(obj):
    """True if input looks like a GraphViz chart."""
    return (
        is_type(obj, 'graphviz.dot.Graph') or
        is_type(obj, 'graphviz.dot.Digraph')
    )


def _is_plotly_obj(obj):
    """True if input if from a type that lives in plotly.plotly_objs."""
    the_type = type(obj)
    return the_type.__module__.startswith('plotly.graph_objs')


def _is_list_of_plotly_objs(obj):
    if type(obj) is not list:
        return False
    if len(obj) == 0:
        return False
    return all(_is_plotly_obj(item) for item in obj)


def _is_probably_plotly_dict(obj):
    if type(obj) not in dict_types:
        return False

    if len(obj.keys()) == 0:
        return False

    if any(k not in ['config', 'data', 'frames', 'layout']
           for k in obj.keys()):
        return False

    if any(_is_plotly_obj(v) for v in obj.values()):
        return True

    if any(_is_list_of_plotly_objs(v) for v in obj.values()):
        return True

    return False


def is_repl():
    """Return True if running in the Python REPL."""
    import inspect
    root_frame = inspect.stack()[-1]
    filename = root_frame[1]  # 1 is the filename field in this tuple.

    if filename.endswith(os.path.join('bin', 'ipython')):
        return True

    # <stdin> is what the basic Python REPL calls the root frame's
    # filename, and <string> is what iPython sometimes calls it.
    if filename in ('<stdin>', '<string>'):
        return True

    return False


def get_streamlit_file_path(*filepath):
    """Return the full path to a filepath in ~/.streamlit.

    Creates ~/.streamlit if needed.
    """
    # os.path.expanduser works on OSX, Linux and Windows
    home = os.path.expanduser('~')
    if home is None:
        raise RuntimeError('No home directory.')

    folder_path = filepath[:-1]
    st_path = os.path.join(home, STREAMLIT_ROOT_DIRECTORY, *folder_path)

    if not os.path.isdir(st_path):
        os.makedirs(st_path)

    return os.path.join(home, STREAMLIT_ROOT_DIRECTORY, *filepath)


def forwardmsg_to_debug(msg):
    """Convert a ForwardMsg into a dict for debugging."""
    the_type = msg.WhichOneof('type')
    if the_type == 'delta':
        return {'delta': delta_to_debug(msg.delta)}
    return the_type


def delta_to_debug(delta):
    """Convert a Delta into a dict for debugging."""
    the_type = delta.WhichOneof('type')
    out = {
        'id': delta.id
    }

    if the_type == 'new_element':
        out['new_element'] = delta.new_element.WhichOneof('type')
    elif the_type == 'add_rows':
        out['add_rows'] = ''

    return out


def print_url(title, url):
    """Pretty-print a URL on the terminal."""
    click.secho('  %s: ' % title, nl=False)
    click.secho(url, bold=True)
