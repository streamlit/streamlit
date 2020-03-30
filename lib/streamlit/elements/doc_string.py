# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

import inspect

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


CONFUSING_STREAMLIT_MODULES = ("streamlit.DeltaGenerator", "streamlit.caching")

CONFUSING_STREAMLIT_SIG_PREFIXES = ("(element, ",)


def marshall(proto, obj):
    """Construct a DocString object.

    See DeltaGenerator.help for docs.
    """
    try:
        proto.doc_string.name = obj.__name__
    except AttributeError:
        pass

    module_name = getattr(obj, "__module__", None)

    if module_name in CONFUSING_STREAMLIT_MODULES:
        proto.doc_string.module = "streamlit"
    elif module_name is not None:
        proto.doc_string.module = module_name
    else:
        # Leave proto.doc_string.module as an empty string (default value).
        pass

    obj_type = type(obj)
    proto.doc_string.type = str(obj_type)

    if callable(obj):
        proto.doc_string.signature = _get_signature(obj)

    doc_string = inspect.getdoc(obj)

    # Sometimes an object has no docstring, but the object's type does.
    # If that's the case here, use the type's docstring.
    # For objects where type is type we do not print the docs.
    # We also do not print the docs for functions and methods if
    # the docstring is empty.
    if (
        doc_string is None
        and obj_type is not type
        and not inspect.isfunction(obj)
        and not inspect.ismethod(obj)
    ):
        doc_string = inspect.getdoc(obj_type)

    if doc_string is None:
        doc_string = "No docs available."

    proto.doc_string.doc_string = doc_string


def _get_signature(f):
    is_delta_gen = False
    try:
        is_delta_gen = f.__module__ == "streamlit.DeltaGenerator"

        if is_delta_gen:
            # DeltaGenerator functions are doubly wrapped, and their function
            # signatures are useless unless we unwrap them.
            f = _unwrap_decorated_func(f)

    # Functions such as numpy.minimum don't have a __module__ attribute,
    # since we're only using it to check if its a DeltaGenerator, its ok
    # to continue
    except AttributeError:
        pass

    sig = ""

    try:
        sig = str(inspect.signature(f))
    except ValueError:
        # f is a builtin.
        pass

    if is_delta_gen:
        for prefix in CONFUSING_STREAMLIT_SIG_PREFIXES:
            if sig.startswith(prefix):
                sig = sig.replace(prefix, "(")
                break

    return sig


def _unwrap_decorated_func(f):
    if hasattr(f, "func_closure"):
        try:
            # Python 2 way.
            while getattr(f, "func_closure"):
                contents = f.func_closure[0].cell_contents
                if not callable(contents):
                    break
                f = contents
            return f
        except AttributeError:
            pass

    if hasattr(f, "__wrapped__"):
        try:
            # Python 3 way.
            while getattr(f, "__wrapped__"):
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
