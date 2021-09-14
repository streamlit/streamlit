# Copyright 2018-2021 Streamlit Inc.
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

from typing import cast

import streamlit
from streamlit.proto.DocString_pb2 import DocString as DocStringProto
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


CONFUSING_STREAMLIT_MODULES = (
    "streamlit.delta_generator",
    "streamlit.legacy_caching.caching",
)

CONFUSING_STREAMLIT_SIG_PREFIXES = ("(element, ",)


class HelpMixin:
    def help(self, obj):
        """Display object's doc string, nicely formatted.

        Displays the doc string for this object.

        Parameters
        ----------
        obj : Object
            The object whose docstring should be displayed.

        Example
        -------

        Don't remember how to initialize a dataframe? Try this:

        >>> st.help(pandas.DataFrame)

        Want to quickly check what datatype is output by a certain function?
        Try:

        >>> x = my_poorly_documented_function()
        >>> st.help(x)

        """
        doc_string_proto = DocStringProto()
        _marshall(doc_string_proto, obj)
        return self.dg._enqueue("doc_string", doc_string_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def _marshall(doc_string_proto, obj):
    """Construct a DocString object.

    See DeltaGenerator.help for docs.
    """
    try:
        doc_string_proto.name = obj.__name__
    except AttributeError:
        pass

    module_name = getattr(obj, "__module__", None)

    if module_name in CONFUSING_STREAMLIT_MODULES:
        doc_string_proto.module = "streamlit"
    elif module_name is not None:
        doc_string_proto.module = module_name
    else:
        # Leave doc_string_proto.module as an empty string (default value).
        pass

    obj_type = type(obj)
    doc_string_proto.type = str(obj_type)

    if callable(obj):
        doc_string_proto.signature = _get_signature(obj)

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

    doc_string_proto.doc_string = doc_string


def _get_signature(f):
    is_delta_gen = False
    try:
        is_delta_gen = f.__module__ == "streamlit.delta_generator"

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
    if hasattr(f, "__wrapped__"):
        try:
            while getattr(f, "__wrapped__"):
                contents = f.__wrapped__
                if not callable(contents):
                    break
                f = contents
            return f
        except AttributeError:
            pass

    # Fall back to original function, though it's unlikely we'll reach
    # this part of the code.
    return f
