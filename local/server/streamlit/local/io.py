"""This package contains all functions which the user can use to
create new elements in a Report."""

import sys
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
