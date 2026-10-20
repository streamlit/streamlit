# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Report a widget's stored value in the form a request can send back.

The widget's own serializer is the mapping the runtime applies in reverse, so
a ``format_func`` label, text typed into a widget that accepts new options,
and a selected ``None`` option come back as a request would send them.
"""

from __future__ import annotations

from copy import deepcopy
from itertools import starmap
from typing import TYPE_CHECKING, Any, Final

from streamlit.dataframe_util import convert_anything_to_list
from streamlit.logger import get_logger
from streamlit.runtime.agent import json_encoding

if TYPE_CHECKING:
    from streamlit.runtime.state.session_state import SessionState

_LOGGER: Final = get_logger(__name__)

# Widgets whose wire value is text. Their serializer is what turns a stored
# Python value into that text -- a `format_func` label, an ISO date -- so a
# value reported through it is one a request can send back, whether or not the
# widget registered an option list.
_STRING_WIRE_TYPES: Final = {"string_value", "string_array_value"}


def reported_value(
    session_state: SessionState | None,
    element_id: str,
    *,
    options: list[Any] | None = None,
    value_schema: dict[str, Any] | None = None,
    accept_new_options: bool = False,
) -> Any:
    """Return the value a request can send back, or ``None`` when unavailable.

    - Options are reported as their ``format_func`` label.
    - Text typed into an ``accept_new_options`` widget is kept as typed.
    - A non-JSON text-wire value is the serializer's output, such as an ISO date.
    - Everything else is the JSON-encoded Python value.
    """
    if session_state is None:
        return None
    try:
        # The stored value, which can differ from what st.session_state
        # returns. A serialized chat proto is read without its
        # deserializer, which drops uploads.
        value = session_state.get_widget_value(element_id)
    except KeyError:
        return None

    metadata = session_state.get_widget_metadata(element_id)
    if metadata is not None and metadata.value_type == "chat_input_value":
        # Files and audio stay with the upload. The schema is the text.
        from streamlit.elements.widgets.chat import ChatInputValue

        if isinstance(value, ChatInputValue):
            value = value.text
    if metadata is not None and (
        options is not None
        or (
            metadata.value_type in _STRING_WIRE_TYPES
            and not (value is None or isinstance(value, (str, int, float)))
        )
    ):
        try:
            # The serializer calls the author's ``format_func``. Registration
            # copies before it serializes, so a formatter that edits its
            # argument cannot change the value a snapshot just read.
            serialized = _string_payload(metadata.serializer(deepcopy(value)))
            if (
                isinstance(serialized, list)
                and (value_schema or {}).get("type") != "array"
            ):
                # A single choice is a one-item list on the wire, including
                # when the option itself is a tuple or list. A list-valued
                # widget's schema is an array, so that list stays a list.
                serialized = serialized[0] if len(serialized) == 1 else None
            value = _keep_typed_text(
                value,
                serialized,
                options,
                _authored_options(metadata.serializer),
                accept_new_options=accept_new_options,
            )
        except Exception:
            # The stored object is not a value a request can send back.
            _LOGGER.warning(
                "Could not serialize the value of %s; reporting null.",
                element_id,
                exc_info=True,
            )
            return None

    try:
        return json_encoding.to_json_value(value)
    except Exception:
        _LOGGER.warning(
            "Could not encode the value of %s.",
            element_id,
            exc_info=True,
        )
        return None


def _string_payload(serialized: Any) -> Any:
    """The string a trigger proto carries, or ``serialized`` unchanged.

    ``st.menu_button`` and ``st.chat_input`` serialize to a protobuf whose
    ``data`` field is the text a request sends. The field is optional, and an
    unset one reads back as ``""``, which is an unfired trigger rather than a
    payload. The proto itself is not JSON.
    """
    if hasattr(serialized, "HasField"):
        try:
            if not serialized.HasField("data"):
                return None
        except ValueError:
            # A proto whose `data` field is always present has no presence bit.
            pass
    data = getattr(serialized, "data", None)
    if isinstance(data, str):
        return data
    return serialized


def _authored_options(serializer: Any) -> list[Any] | tuple[Any, ...] | None:
    """The option objects the serializer was built with, when it has them.

    Selection serdes keep those objects on ``options``. Typed text is detected
    by comparing against that list.
    """
    options = getattr(getattr(serializer, "__self__", None), "options", None)
    if isinstance(options, (list, tuple)):
        return options
    return None


def _option_equals(item: Any, option: Any) -> bool:
    """Whether ``item`` is ``option``.

    Equality on an array-like option returns another array, and using that
    result as a condition raises. A scalar result, including a NumPy ``bool_``,
    is a match when it is true. An array is not.
    """
    try:
        result = item == option
    except Exception:
        return False
    if isinstance(result, bool):
        return result
    # NumPy's scalar bool is not a builtin bool. A 0-d result has one truth
    # value; an array or a Series does not, and ``bool()`` on it raises.
    if getattr(result, "ndim", None) != 0:
        return False
    try:
        return bool(result)
    except Exception:
        return False


def _index_authored(
    authored: list[Any] | tuple[Any, ...] | None,
) -> tuple[set[Any], list[Any]] | None:
    """Split authored options into a hash lookup and an unhashable remainder."""
    if authored is None:
        return None
    hashed: set[Any] = set()
    linear: list[Any] = []
    for option in authored:
        try:
            hashed.add(option)
        except Exception:
            # Unhashable options, and options whose equality raises while the
            # set checks a collision, stay on the linear scan.
            linear.append(option)
    return hashed, linear


def _is_authored(item: Any, index: tuple[set[Any], list[Any]]) -> bool:
    """Whether ``item`` is one of the indexed authored options."""
    hashed, linear = index
    try:
        if item in hashed:
            return True
    except Exception:
        return any(_option_equals(item, option) for option in (*hashed, *linear))
    return any(_option_equals(item, option) for option in linear)


def _keep_typed_text(
    stored: Any,
    serialized: Any,
    options: list[Any] | None,
    authored: list[Any] | tuple[Any, ...] | None = None,
    *,
    accept_new_options: bool = False,
) -> Any:
    """Return the serialized value, but keep text a user typed.

    Only a widget that accepts new options can hold text that is not one of
    its options. ``format_func`` runs on that text, so echoing the result back
    would reformat it on every round trip. Text that is one of the authored
    options is still reported as its label. A closed option set reports the
    label, including when the stored value merely formats to one.
    """
    if options is None:
        return serialized
    try:
        allowed: set[Any] | None = set(options)
    except TypeError:
        allowed = None
    authored_index = _index_authored(authored) if accept_new_options else None

    def _is_option(label: Any) -> bool:
        if allowed is None:
            return label in options
        return label in allowed

    def _report(item: Any, label: Any) -> Any:
        # Typed text can format to a label without being that option. A closed
        # set has no typed text, so a value that formats to a label is it.
        if (
            accept_new_options
            and isinstance(item, str)
            and authored_index is not None
            and not _is_authored(item, authored_index)
        ):
            return item
        if _is_option(label) or not isinstance(item, str):
            return label
        return item

    # A multi-select stored through session state may be a set, array, or
    # Series. The serde lists those the same way, and each item lines up with
    # its formatted label. A string is one option, not a sequence of characters.
    items: list[Any] | tuple[Any, ...] | None
    if isinstance(stored, (list, tuple)):
        items = stored
    elif isinstance(serialized, list) and not isinstance(stored, str):
        items = convert_anything_to_list(stored)
    else:
        items = None
    if (
        items is not None
        and isinstance(serialized, list)
        and len(items) == len(serialized)
    ):
        return list(starmap(_report, zip(items, serialized, strict=True)))
    return _report(stored, serialized)
