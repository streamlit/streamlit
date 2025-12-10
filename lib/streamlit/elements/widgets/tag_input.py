# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Sequence,
    cast,
)

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.TagInput_pb2 import TagInput as TagInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import register_widget

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


@dataclass
class TagInputSerde:
    """Serializer/Deserializer for TagInput widget values."""

    default_value: list[str]

    def serialize(self, value: list[str]) -> list[str]:
        """Convert Python list to proto-compatible format.

        Parameters
        ----------
        value : list[str]
            The list of tag strings to serialize.

        Returns
        -------
        list[str]
            The serialized list of tag strings.
        """
        return list(value) if value else []

    def deserialize(self, ui_value: list[str] | None) -> list[str]:
        """Convert proto value back to Python list.

        Parameters
        ----------
        ui_value : list[str] | None
            The value from the frontend, or None if not set.

        Returns
        -------
        list[str]
            The deserialized list of tag strings.
        """
        return list(ui_value) if ui_value is not None else list(self.default_value)


def _validate_tags(
    tags: list[str],
    *,
    max_tags: int | None,
    allow_duplicates: bool,
) -> list[str]:
    """Validate and clean a list of tags.

    Parameters
    ----------
    tags : list[str]
        The list of tags to validate.
    max_tags : int | None
        Maximum number of tags allowed. None means unlimited.
    allow_duplicates : bool
        Whether duplicate tags are allowed.

    Returns
    -------
    list[str]
        The validated list of tags (whitespace-only tags removed,
        duplicates removed if not allowed).
    """
    validated: list[str] = []
    seen: set[str] = set()

    for tag in tags:
        # Skip whitespace-only tags (Requirement 2.4)
        if not tag or tag.isspace():
            continue

        # Handle duplicates (Requirements 7.1, 7.2)
        if not allow_duplicates:
            if tag in seen:
                continue
            seen.add(tag)

        validated.append(tag)

        # Enforce max_tags limit (Requirement 4.1)
        if max_tags is not None and len(validated) >= max_tags:
            break

    return validated


class TagInputMixin:
    @gather_metrics("tag_input")
    def tag_input(
        self,
        label: str,
        value: list[str] | None = None,
        *,
        options: Sequence[str] | None = None,
        max_tags: int | None = None,
        allow_duplicates: bool = False,
        placeholder: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[str]:
        r"""Display a tag input widget.

        The tag input widget allows users to enter multiple free-form text
        values displayed as removable tags (chips). This is useful for
        collecting multiple discrete text inputs such as email addresses,
        keywords, labels, or filter criteria.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed.

        value : list[str] or None
            The initial list of tags to display. If None, the widget starts
            empty.

        options : Sequence[str] or None
            An optional list of autocomplete suggestions. When provided, the
            widget will show matching suggestions as the user types. Users can
            still enter values not in this list.

        max_tags : int or None
            The maximum number of tags allowed. If None (default), there is no
            limit. Must be a non-negative integer if provided.

        allow_duplicates : bool
            Whether to allow duplicate tag values. Default is False, which
            prevents users from adding tags that already exist in the list.

        placeholder : str or None
            A string to display when no tags are present and the input is
            empty. If None (default), a default placeholder is shown.

        key : str or int
            An optional string or integer to use as the unique key for the
            widget. If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``.

        on_change : callable
            An optional callback invoked when the tag list changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the tag input widget if set
            to True. The default is False.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is "visible". If this
            is "hidden", Streamlit displays an empty spacer instead of the
            label. If this is "collapsed", Streamlit displays no label or
            spacer.

        Returns
        -------
        list[str]
            The current list of tags.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> tags = st.tag_input("Enter keywords", value=["python", "streamlit"])
        >>> st.write("You entered:", tags)

        >>> # With autocomplete suggestions
        >>> tags = st.tag_input(
        ...     "Select technologies",
        ...     options=["Python", "JavaScript", "TypeScript", "Rust"],
        ...     max_tags=5,
        ... )

        """
        ctx = get_script_run_ctx()
        return self._tag_input(
            label=label,
            value=value,
            options=options,
            max_tags=max_tags,
            allow_duplicates=allow_duplicates,
            placeholder=placeholder,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _tag_input(
        self,
        label: str,
        value: list[str] | None = None,
        *,
        options: Sequence[str] | None = None,
        max_tags: int | None = None,
        allow_duplicates: bool = False,
        placeholder: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> list[str]:
        key = to_key(key)

        widget_name = "tag_input"
        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        # Validate max_tags parameter (Requirement 4.1)
        if max_tags is not None and max_tags < 0:
            raise StreamlitAPIException(
                f"max_tags must be a non-negative integer, got {max_tags}"
            )

        # Validate value type
        if value is not None and not isinstance(value, (list, tuple)):
            raise StreamlitAPIException(
                f"value must be a list of strings, got {type(value).__name__}"
            )

        # Validate options type
        if options is not None and not isinstance(options, (list, tuple)):
            raise StreamlitAPIException(
                f"options must be a sequence of strings, got {type(options).__name__}"
            )

        # Process initial value
        initial_value: list[str] = list(value) if value else []

        # Validate and clean initial tags
        validated_value = _validate_tags(
            initial_value,
            max_tags=max_tags,
            allow_duplicates=allow_duplicates,
        )

        # Process options
        options_list: list[str] = list(options) if options else []

        form_id = current_form_id(self.dg)
        element_id = compute_and_register_element_id(
            widget_name,
            user_key=key,
            key_as_main_identity={
                "options",
                "max_tags",
                "allow_duplicates",
            },
            dg=self.dg,
            label=label,
            default=validated_value,
            options=options_list,
            help=help,
            max_tags=max_tags,
            placeholder=placeholder,
            allow_duplicates=allow_duplicates,
        )

        proto = TagInputProto()
        proto.id = element_id
        proto.label = label
        proto.default[:] = validated_value
        proto.options[:] = options_list
        proto.form_id = form_id
        proto.disabled = disabled
        proto.max_tags = max_tags if max_tags is not None else 0
        proto.placeholder = placeholder or ""
        proto.allow_duplicates = allow_duplicates
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        if help is not None:
            proto.help = dedent(help)

        serde = TagInputSerde(default_value=validated_value)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_array_value",
        )

        # Validate the current widget value
        current_value = _validate_tags(
            widget_state.value,
            max_tags=max_tags,
            allow_duplicates=allow_duplicates,
        )

        if widget_state.value_changed:
            proto.value[:] = serde.serialize(current_value)
            proto.set_value = True

        self.dg._enqueue(widget_name, proto)

        return current_value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
