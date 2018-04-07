"""This package contains all functions which the user can use to
create new elements in a Report."""

import sys
import types

from streamlit.shared.DeltaGenerator import DeltaGenerator, EXPORT_TO_IO_FLAG
from streamlit.local.connection import get_delta_generator

# Basically, the functions in this package wrap member functions of
# DeltaGenerator. What they do is get the DeltaGenerator from the
# singleton connection object (in streamlit.local.connection) and then
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
        setattr(sys.modules[__name__], method.__name__, wrap_method(method))

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

    This is an example of overwriting things::

        write('My answer is:')
        my_answer = write('No.')
        my_asnwer.write('Yes!')

    which writes::

        My answer is:
        Yes!

    Note that overwriting is only possible when write is passed a single
    argument.
    """
    return markdown(*args) # debug
    # return markdown(*args)
    string_buffer = []
    def flush_buffer():
        if string_buffer:
            self.text(' '.join(string_buffer))
            string_buffer[:] = []

    for arg in args:
        if type(arg) == str:
            string_buffer.append(arg)
        elif isinstance(arg, DATAFRAME_LIKE_TYPES):
            flush_buffer()
            self.dataframe(arg)
        elif isinstance(arg, Exception):
            flush_buffer()
            self.error(str(arg))
        elif callable(arg) or isinstance(arg, types.ModuleType):
            flush_buffer()
            self.help(arg)
        elif isinstance(arg, FIGURE_LIKE_TYPES):
            flush_buffer()
            self.chart(arg)
        else:
            string_buffer.append(str(arg))

    flush_buffer()
