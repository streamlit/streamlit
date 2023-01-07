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

import ast
import contextlib
import inspect
import re
import types
from typing import TYPE_CHECKING, Any, cast

from typing_extensions import Final

from streamlit.logger import get_logger
from streamlit.proto.DocString_pb2 import DocString as DocStringProto
from streamlit.proto.DocString_pb2 import Member as MemberProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner.script_runner import (
    __file__ as SCRIPTRUNNER_FILENAME,
)
from streamlit.runtime.secrets import Secrets
from streamlit.string_util import is_mem_address_str

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


LOGGER: Final = get_logger(__name__)


CONFUSING_STREAMLIT_SIG_PREFIXES: Final = ("(element, ",)


class HelpMixin:
    @gather_metrics("help")
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

        >>> import streamlit as st
        >>> import pandas
        >>>
        >>> st.help(pandas.DataFrame)

        Want to quickly check what datatype is output by a certain function?
        Try:

        >>> import streamlit as st
        >>>
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
    var_name = _get_variable_name()
    if var_name is not None:
        doc_string_proto.name = var_name

    obj_type = _get_type_as_str(obj)
    doc_string_proto.type = obj_type

    obj_docs = _get_docstring(obj)
    if obj_docs is not None:
        doc_string_proto.doc_string = obj_docs

    obj_value = _get_value(obj, var_name)

    if obj_value is not None:
        doc_string_proto.value = obj_value

    doc_string_proto.members.extend(_get_members(obj))


def _get_name(obj):
    # Try to get the fully-qualified name of the object.
    # For example:
    #   st.help(bar.Baz(123))
    #
    #   The name is bar.Baz
    name = getattr(obj, "__qualname__", None)
    if name:
        return name

    # Try to get the name of the object.
    # For example:
    #   st.help(bar.Baz(123))
    #
    #   The name is Baz
    name = getattr(obj, "__name__", None)
    return name


def _get_module(obj):
    return getattr(obj, "__module__", None)


def _get_signature(obj):
    if not inspect.isclass(obj) and not callable(obj):
        return None

    sig = ""

    # TODO: Can we replace below with this?
    # with contextlib.suppress(ValueError):
    #     sig = str(inspect.signature(obj))

    try:
        sig = str(inspect.signature(obj))
    except ValueError:
        sig = "(...)"
    except TypeError:
        return None

    is_delta_gen = False
    with contextlib.suppress(AttributeError):
        is_delta_gen = obj.__module__ == "streamlit.delta_generator"
        # Functions such as numpy.minimum don't have a __module__ attribute,
        # since we're only using it to check if its a DeltaGenerator, its ok
        # to continue

    if is_delta_gen:
        for prefix in CONFUSING_STREAMLIT_SIG_PREFIXES:
            if sig.startswith(prefix):
                sig = sig.replace(prefix, "(")
                break

    return sig


class UNSET:
    pass


def _get_docstring(obj):
    doc_string = inspect.getdoc(obj)

    # Sometimes an object has no docstring, but the object's type does.
    # If that's the case here, use the type's docstring.
    # For objects where type is "type" we do not print the docs (e.g. int).
    # We also do not print the docs for functions and methods if the docstring is empty.
    if doc_string is None:
        obj_type = type(obj)

        if (
            obj_type is not type
            and obj_type is not types.ModuleType
            and not inspect.isfunction(obj)
            and not inspect.ismethod(obj)
        ):
            doc_string = inspect.getdoc(obj_type)

    if doc_string:
        return doc_string.strip()

    return None


_NEWLINES = re.compile(r"[\n\r]+")


def _get_variable_name():
    """Try to get the name of the variable in the current line, as set by the user.

    For example:
    foo = bar.Baz(123)
    st.help(foo)

    The name is "foo"
    """
    scriptrunner_frame = _get_scriptrunner_frame()

    if scriptrunner_frame is None:
        return None

    code_context = scriptrunner_frame.code_context

    if not code_context:
        return None

    code_as_string = "".join(code_context)
    cleaned_code = re.sub(_NEWLINES, "", code_as_string.strip())

    tree = ast.parse(cleaned_code)

    # Example:
    #
    # tree = Module(
    #   body=[
    #     Expr(
    #       value=Call(
    #         args=[
    #           Name(id='the variable name')
    #         ],
    #         keywords=[
    #           ???
    #         ],
    #       )
    #     )
    #   ]
    # )

    # Get argument from st.help call
    arg_node = _get_stcall_arg(tree, command_name="help")

    if arg_node is None:
        # Get argument from st.write call
        arg_node = _get_stcall_arg(tree, command_name="write")

    if arg_node is None:
        # Return argument whole line, since it's probably a magic call.
        code = cleaned_code

        # A common pattern is to add "," at the end of a magic command to make it print.
        # This removes that final ",", so it looks nicer.
        if code.endswith(","):
            code = code[:-1]

        return code

    # If walrus, get name. E.g. st.help(foo := 123)
    if type(arg_node) is ast.NamedExpr:
        return arg_node.target.id

    # If constant, there's no variable name. E.g. st.help("foo") or st.help(123)
    if type(arg_node) is ast.Constant:
        return None

    # Otherwise, return whatever is inside st.help(<-- here -->)
    return cleaned_code[arg_node.col_offset : arg_node.end_col_offset]


def _get_scriptrunner_frame():
    active_frame = inspect.currentframe()
    prev_frame = None
    scriptrunner_frame = None

    # Look back in call stack to get the variable name passed into st.help().
    # The frame *before* the ScriptRunner frame is the correct one.
    # IMPORTANT: This will change if we refactor the code. But hopefully our tests will catch the
    # issue and we'll fix it before it lands upstream!
    for frame in inspect.getouterframes(active_frame):
        # Check if this is running inside a funny "exec()" block that won't provide the info we
        # need. If so, just quit.
        if frame.code_context is None and frame.filename == "<string>":
            return None

        if frame.filename == SCRIPTRUNNER_FILENAME:
            scriptrunner_frame = prev_frame
            break

        prev_frame = frame

    return scriptrunner_frame


def _get_stcall_arg(tree, command_name):
    """Gets the argument node for st.help() given the AST for that line of code."""

    root_node = tree.body[0].value

    if type(root_node) is ast.Call:

        # st.help should work when called as "help()":
        if getattr(root_node.func, "id", None) == command_name:
            return root_node.args[0]

        # st.help should work when called as "foo.help()" (where usually "foo" is "st"):
        if getattr(root_node.func, "attr", None) == command_name:
            return root_node.args[0]

    # This doesn't look like an st.help AST. Return None.
    return None


def _get_type_as_str(obj):
    if inspect.isclass(obj):
        return "class"

    return str(type(obj).__name__)


def _get_first_line(text):
    if not text:
        return ""

    left, _, _ = text.partition("\n")
    return left


def _get_weight(value):
    if inspect.ismodule(value):
        return 3
    if inspect.isclass(value):
        return 2
    if callable(value):
        return 1
    return 0


def _get_value(obj, var_name):
    obj_value = _get_human_readable_value(obj)

    if obj_value is not None:
        return obj_value

    # If there's no human-readable value, it's some complex object.
    # So let's provide other info about it.
    name = _get_name(obj)

    if name:
        name_obj = obj
    else:
        # If the object itself doesn't have a name, then it's probably an instance
        # of some class Foo. So let's show info about Foo in the value slot.
        name_obj = type(obj)
        name = _get_name(name_obj)

    module = _get_module(name_obj)
    sig = _get_signature(name_obj) or ""

    if name:
        if module:
            obj_value = f"{module}.{name}{sig}"
        else:
            obj_value = f"{name}{sig}"

    if obj_value == var_name:
        # No need to repeat the same info.
        # For example: st.help(re) shouldn't show "re module re", just "re module".
        obj_value = None

    return obj_value


def _get_human_readable_value(value):
    if isinstance(value, Secrets):
        # Don't want to read secrets.toml because that will show a warning if there's no
        # secrets.toml file.
        return None

    if inspect.isclass(value) or inspect.ismodule(value) or callable(value):
        return None

    value_str = repr(value)

    if isinstance(value, str):
        # Special-case strings as human-readable because they're allowed to look like
        # "<foo blarg at 0x15ee6f9a0>".
        return _shorten(value_str)

    if is_mem_address_str(value_str):
        # If value_str looks like "<foo blarg at 0x15ee6f9a0>" it's not human readable.
        return None

    return _shorten(value_str)


def _shorten(s, length=300):
    s = s.strip()
    return s[:length] + "..." if len(s) > length else s


def _is_computed_property(obj, attr_name):
    obj_class = getattr(obj, "__class__", None)

    if not obj_class:
        return False

    # Go through superclasses in order of inheritance (mro) to see if any of them have an
    # attribute called attr_name. If so, check if it's a @property.
    for parent_class in inspect.getmro(obj_class):
        class_attr = getattr(parent_class, attr_name, None)

        if class_attr is None:
            continue

        # If is property, return it.
        if isinstance(class_attr, property) or inspect.isgetsetdescriptor(class_attr):
            return True

    return False


def _get_members(obj):
    members_for_sorting = []

    for attr_name in dir(obj):
        if attr_name.startswith("_"):
            continue

        is_computed_value = _is_computed_property(obj, attr_name)

        if is_computed_value:
            parent_attr = getattr(obj.__class__, attr_name)

            member_type = "property"

            weight = 0
            member_docs = _get_docstring(parent_attr)
            member_value = None
        else:
            attr_value = getattr(obj, attr_name)
            weight = _get_weight(attr_value)

            human_readable_value = _get_human_readable_value(attr_value)

            member_type = _get_type_as_str(attr_value)

            if human_readable_value is None:
                member_docs = _get_docstring(attr_value)
                member_value = None
            else:
                member_docs = None
                member_value = human_readable_value

        if member_type == "module":
            # Don't pollute the output with all imported modules.
            continue

        member = MemberProto()
        member.name = attr_name
        member.type = member_type

        if member_docs is not None:
            member.doc_string = _get_first_line(member_docs)

        if member_value is not None:
            member.value = member_value

        members_for_sorting.append((weight, member))

    if members_for_sorting:
        _, members = zip(*sorted(members_for_sorting, key=lambda x: (x[0], x[1].name)))
        return members

    return []
