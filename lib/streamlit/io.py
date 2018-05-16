"""This package contains all functions which the user can use to
create new elements in a Report."""

import contextlib
import numpy as np
import pandas as pd
import re
import sys
import textwrap
import traceback
import types

from streamlit.Chart import Chart
from streamlit.connection import get_delta_generator
from streamlit.util import escape_markdown
from streamlit.DeltaGenerator import DeltaGenerator, EXPORT_TO_IO_FLAG

# Basically, the functions in this package wrap member functions of
# DeltaGenerator. What they do is get the DeltaGenerator from the
# singleton connection object (in streamlit.connection) and then
# call the corresponding function on that DeltaGenerator.
for name in dir(DeltaGenerator):
    method = getattr(DeltaGenerator, name)
    if hasattr(method, EXPORT_TO_IO_FLAG):
        # We introduce this level of indirection to wrap 'method' in a closure.
        def wrap_method(method):
            def wrapped_method(*args, **kwargs):
                return method(get_delta_generator(), *args, **kwargs)
            wrapped_method.__name__ = method.__name__
            wrapped_method.__doc__ = method.__doc__
            return wrapped_method
        setattr(sys.modules[__name__], name, wrap_method(method))

def write(*args):
    """Writes its arguments to the Report.

    Prints its arguments to the current Report. Unlike other streamlit
    functions, write() has two unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. It's behavior depends on the input types as follows.

    Args
    ----
    *args : any
        One or many objects to print to the Report.

    Arguments are handled as follows:

        - write(string)     : Prints the formatted Markdown string.
        - write(data_frame) : Displays the DataFrame as a table.
        - write(error)      : Prints an exception specially.
        - write(func)       : Displays information about a function.
        - write(module)     : Displays infomration about the module.
        - write(obj)        : The default is to print str(obj).

    Returns
    -------
    If *one* argument is passed, write() returns a DeltaGenerator
    which allows you to overwrite this element.

    IF *multiple* arguments are passed, write() returns none.

    Examples
    --------
    These are examples of writing things::

        write('Hello, *World!*')
        write('1 + 1 = ', 2)
        write('This is a DataFrame', data_frame, 'No, really!!')
    """
    DATAFRAME_LIKE_TYPES = (
        pd.DataFrame,
        pd.Series,
        pd.Index,
        np.ndarray,
    )

    HELP_TYPES = (
        types.FunctionType,
        types.ModuleType,
    )

    FIGURE_LIKE_TYPES = (
        Chart,
    )
    # return markdown(*args)
    try:
        string_buffer = []
        def flush_buffer():
            if string_buffer:
                markdown(' '.join(string_buffer))
                string_buffer[:] = []

        for arg in args:
            if type(arg) == str:
                string_buffer.append(arg)
            elif isinstance(arg, DATAFRAME_LIKE_TYPES):
                flush_buffer()
                dataframe(arg)
            elif isinstance(arg, Exception):
                flush_buffer()
                exception(arg)
            elif isinstance(arg, HELP_TYPES):
                flush_buffer()
                help(arg)
            elif isinstance(arg, FIGURE_LIKE_TYPES):
                flush_buffer()
                chart(arg)
            else:
                string_buffer.append('`%s`' % escape_markdown(str(arg)))

        flush_buffer()
    except Exception as e:
        exception(e)

@contextlib.contextmanager
def spinner(text):
    """Temporarily displays a message while executing a block of code.

    Args
    ----
    text : string
        A message to display while executing that block

    Examples
    --------
    ::

        with io.spinner('Wait for it...'):
            time.sleep(5)
        io.success('Done!')
    """
    try:
        message = warning(text)
        yield
    finally:
        message.empty()

@contextlib.contextmanager
def echo():
    """Render the given code, then execute it.

    Example
    -------
    ::
        with io.echo():
            io.write('This code will be printed')
    """
    code = empty()
    try:
        spaces = re.compile('\s*')
        frame = traceback.extract_stack()[-3]
        filename, start_line = frame.filename, frame.lineno
        yield
        end_line = traceback.extract_stack()[-3].lineno
        lines_to_display = []
        with open(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])
            initial_spaces = spaces.match(lines_to_display[0]).end()
            for line in source_lines[end_line+1:]:
                if spaces.match(line).end() < initial_spaces:
                    break
                lines_to_display.append(line)
        lines_to_display = textwrap.dedent(''.join(lines_to_display))
        code.markdown(f'```\n{lines_to_display}\n```')
    except FileNotFoundError as err:
        code.warning(f'Unable to display code. {str(err)}')

# This is a necessary (but not sufficient) condition to establish that this
# is the proxy process.
_this_may_be_proxy = sys.argv[0] == '-m'

# In order to log all exceptions etc to the streamlit report after
# `import streamlit.io` we establish the proxy by calling get_delta_generator().
# If there's any chance that this is the proxy (i.e. _this_may_be_proxy) then we
# skip this step. Overcautiously skipping this step isn't fatal in general as
# it simply implies that the connection may be established later.
if not _this_may_be_proxy:
    get_delta_generator()
