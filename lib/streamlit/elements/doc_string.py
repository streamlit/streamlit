# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

import contextlib
import inspect
from typing import Any, cast, TYPE_CHECKING
from typing_extensions import Final

from streamlit.proto.DocString_pb2 import DocString as DocStringProto
from streamlit.logger import get_logger
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


LOGGER: Final = get_logger(__name__)


CONFUSING_STREAMLIT_MODULES: Final = (
    "streamlit.echo",
    "streamlit.delta_generator",
    "streamlit.runtime.legacy_caching.caching",
)

CONFUSING_STREAMLIT_SIG_PREFIXES: Final = ("(element, ",)


class HelpMixin:
    @gather_metrics
    def help(self, obj: Any) -> "DeltaGenerator":
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
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _marshall(doc_string_proto: DocStringProto, obj: Any) -> None:
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
    with contextlib.suppress(AttributeError):
        is_delta_gen = f.__module__ == "streamlit.delta_generator"
        # Functions such as numpy.minimum don't have a __module__ attribute,
        # since we're only using it to check if its a DeltaGenerator, its ok
        # to continue

    sig = ""

    with contextlib.suppress(ValueError):
        sig = str(inspect.signature(f))
    if is_delta_gen:
        for prefix in CONFUSING_STREAMLIT_SIG_PREFIXES:
            if sig.startswith(prefix):
                sig = sig.replace(prefix, "(")
                break

    return sig
