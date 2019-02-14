# -*- coding: future_fstrings -*-
# Copyright 2019 Streamlit Inc. All rights reserved.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import inspect

try:
    import funcsigs
except ImportError:
    pass

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


CONFUSING_STREAMLIT_MODULES = (
    'streamlit.DeltaGenerator',
    'streamlit.caching',
)

CONFUSING_STREAMLIT_SIG_PREFIXES = (
    '(self, element, ',
    '(self, _, ',
    '(self, ',
)


def marshall(proto, obj):
    """Construct a DocString object.

    See DeltaGenerator.help for docs.
    """
    try:
        proto.doc_string.name = obj.__name__
    except AttributeError:
        pass

    try:
        if obj.__module__ in CONFUSING_STREAMLIT_MODULES:
            proto.doc_string.module = 'streamlit'
        else:
            proto.doc_string.module = obj.__module__
    except AttributeError:
        pass

    obj_type = type(obj)
    proto.doc_string.type = str(obj_type)

    if callable(obj):
        proto.doc_string.signature = _get_signature(obj)

    doc_string = inspect.getdoc(obj)

    if doc_string is None:
        doc_string = f'No docs available.'

    proto.doc_string.doc_string = doc_string


def _get_signature(f):
    is_delta_gen = f.__module__ == 'streamlit.DeltaGenerator'

    if is_delta_gen:
        # DeltaGenerator functions are doubly wrapped, and their function
        # signatures are useless unless we unwrap them.
        f = _unwrap_decorated_func(f)

    sig = ''

    get_signature = None

    # Python 3.3+
    if hasattr(inspect, 'signature'):
        get_signature = inspect.signature
    else:
        try:
            get_signature = funcsigs.signature
        except NameError:
            # Funcsigs doesn't exist.
            get_signature = lambda x: ''
            pass

    try:
        sig = str(get_signature(f))
    except ValueError:
        # f is a builtin.
        pass

    if is_delta_gen:
        for prefix in CONFUSING_STREAMLIT_SIG_PREFIXES:
            if sig.startswith(prefix):
                sig = sig.replace(prefix, '(')
                break

    return sig


def _unwrap_decorated_func(f):
    if hasattr(f, 'func_closure'):
        try:
            # Python 2 way.
            while getattr(f, 'func_closure'):
                contents = f.func_closure[0].cell_contents
                if not callable(contents):
                    break
                f = contents
            return f
        except AttributeError:
            pass

    if hasattr(f, '__wrapped__'):
        try:
            # Python 3 way.
            while getattr(f, '__wrapped__'):
                contents = f.__wrapped__
                if not callable(contents):
                    break
                f = contents
            return f
        except AttributeError:
            pass

    # Falling back to original function. Which is fine in Python 3 for
    # functions, even if they were decorated with functools.wrap.  No such luck
    # for Python 2, but it's unlikely we'll get to this part of the code
    # anyway.
    return f
