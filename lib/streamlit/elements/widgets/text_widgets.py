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

from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Final, Literal, NamedTuple, cast, overload

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Height,
    WidthWithoutContent,
    create_layout_config,
)
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
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.TextArea_pb2 import TextArea as TextAreaProto
from streamlit.proto.TextInput_pb2 import TextInput as TextInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    BindOption,
    PersistStateOption,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.string_util import validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


@dataclass
class TextInputSerde:
    value: str | None
    max_chars: int | None = None

    def deserialize(self, ui_value: str | None) -> str | None:
        result = ui_value if ui_value is not None else self.value
        if result is not None and self.max_chars is not None:
            result = result[: self.max_chars]
        return result

    def serialize(self, v: str | None) -> str | None:
        return v


@dataclass
class TextAreaSerde:
    value: str | None
    max_chars: int | None = None

    def deserialize(self, ui_value: str | None) -> str | None:
        result = ui_value if ui_value is not None else self.value
        if result is not None and self.max_chars is not None:
            result = result[: self.max_chars]
        return result

    def serialize(self, v: str | None) -> str | None:
        return v


def _parse_text_input_validate(
    validate: str | tuple[str, str] | None,
) -> tuple[str | None, str | None]:
    if validate is None:
        return None, None

    if isinstance(validate, str):
        return validate, None

    if (
        isinstance(validate, tuple)
        and len(validate) == 2
        and all(isinstance(item, str) for item in validate)
    ):
        return validate

    raise StreamlitAPIException(
        "The `validate` parameter must be `None`, a regex string, or a "
        "`(regex, message)` tuple of strings."
    )


# Default (regex, message) validation rules for the specialized text input types.
# The regexes are JS-flavored (compiled with the "us" flags on the frontend) and
# anchored, so they flow through the same `validate` channel as a user-supplied
# rule. The email regex requires a dotted domain (accepts `user@host.tld`,
# rejects `user@host`). The url regex requires a dotted host but makes the
# `http(s)://` scheme optional (and case-insensitive, so `HTTPS://` works too),
# so both `example.com` and `https://example.com` pass while obvious non-URLs
# (plain words, values with spaces) are rejected. The first host label excludes
# `/` so a bare path (`path/to/file.txt`) or a malformed scheme
# (`https://.example.com`) does not sneak through, while paths after the host
# (`example.com/a/b`) still pass. It stays intentionally permissive since it only
# needs to catch clear mistakes; users who want stricter rules can pass their own
# `validate`.
_EMAIL_VALIDATE: Final = (
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
    "Enter a valid email address.",
)
_URL_VALIDATE: Final = (
    r"^([Hh][Tt][Tt][Pp][Ss]?://)?[^\s/.]+\.[^\s]+$",
    "Enter a valid URL.",
)


class _TextInputTypeDefaults(NamedTuple):
    """Type-derived smart defaults for a ``text_input`` ``type`` value.

    A user value always wins; a ``None`` argument falls back to the value here,
    and an empty string (``""``) forces the corresponding feature off.
    """

    proto_type: TextInputProto.Type.ValueType
    icon: str | None
    placeholder: str | None
    validate: tuple[str, str] | None
    autocomplete: str


# Single source of truth mapping each public `type` string to its native input
# type (proto enum) and its overridable smart defaults. Keeping the whole policy
# here means the frontend only needs the enum -> DOM type mapping.
_TEXT_INPUT_TYPE_DEFAULTS: Final[dict[str, _TextInputTypeDefaults]] = {
    "default": _TextInputTypeDefaults(TextInputProto.DEFAULT, None, None, None, ""),
    "password": _TextInputTypeDefaults(
        TextInputProto.PASSWORD, None, None, None, "new-password"
    ),
    "email": _TextInputTypeDefaults(
        TextInputProto.EMAIL,
        ":material/mail:",
        "you@example.com",
        _EMAIL_VALIDATE,
        "email",
    ),
    "url": _TextInputTypeDefaults(
        TextInputProto.URL,
        ":material/link:",
        "https://example.com",
        _URL_VALIDATE,
        "url",
    ),
    "phone": _TextInputTypeDefaults(
        TextInputProto.PHONE,
        ":material/call:",
        "+1 234 567 8900",
        None,
        "tel",
    ),
    "search": _TextInputTypeDefaults(
        TextInputProto.SEARCH,
        ":material/search:",
        "Search",
        None,
        "off",
    ),
}


class TextWidgetsMixin:
    @overload
    def text_input(
        self,
        label: str,
        value: str = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal[
            "default", "password", "email", "url", "phone", "search"
        ] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        validate: str | tuple[str, str] | None = None,
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str:
        pass

    @overload
    def text_input(
        self,
        label: str,
        value: SupportsStr | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal[
            "default", "password", "email", "url", "phone", "search"
        ] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        validate: str | tuple[str, str] | None = None,
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str | None:
        pass

    @gather_metrics("text_input")
    def text_input(
        self,
        label: str,
        value: str | SupportsStr | None = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: Literal[
            "default", "password", "email", "url", "phone", "search"
        ] = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        validate: str | tuple[str, str] | None = None,
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str | None:
        r"""Display a single-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Common block-level Markdown (headings,
            lists, blockquotes) is automatically escaped and displays as
            literal text in labels.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.

        max_chars : int or None
            Max number of characters allowed in text input.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``max_chars`` or the validation regex resets the
               widget even when a key is provided.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        type : "default", "password", "email", "url", "phone", or "search"
            The type of the text input. This sets the underlying native HTML
            input type (which controls things like the mobile keyboard and
            browser autofill) and, for the specialized types, applies
            overridable smart defaults for ``icon``, ``placeholder``,
            ``validate``, and ``autocomplete``. Defaults to ``"default"``.

            - ``"default"``: A regular single-line text input. No smart
              defaults are applied.
            - ``"password"``: A text input that masks the user's typed value.
              ``autocomplete`` defaults to ``"new-password"``.
            - ``"email"``: An input for email addresses. Defaults to a mail
              icon, a ``you@example.com`` placeholder, email-format
              validation, and ``autocomplete="email"``.
            - ``"url"``: An input for web addresses. Defaults to a link icon,
              an ``https://example.com`` placeholder, URL-format validation,
              and ``autocomplete="url"``.
            - ``"phone"``: An input for phone numbers (numeric keypad on
              mobile). Defaults to a call icon, a ``+1 234 567 8900``
              placeholder, and ``autocomplete="tel"``. No default validation
              is applied because phone formats vary too widely.
            - ``"search"``: A free-text search input with a clear button that
              empties the field. Defaults to a search icon, a ``Search``
              placeholder, and ``autocomplete="off"`` (so private search terms
              don't leak into the browser's autofill history). No default
              validation is applied.

            The smart defaults are only applied when you don't pass a value
            for ``icon``, ``placeholder``, ``validate``, or ``autocomplete``.
            For each of these, ``None`` (or omission) uses the type's default,
            an explicit value overrides it, and ``""`` forces the feature off
            (for example, ``icon=""`` shows no icon).

            .. note::
               The default email and URL validation runs in the user's browser
               and can be bypassed. If the validation is security-relevant, you
               must also validate the value on the server (in your app code)
               after it is submitted.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        autocomplete : str or None
            An optional value that will be passed to the <input> element's
            autocomplete property. If this is ``None`` (default), the value is
            derived from ``type``: ``"new-password"`` for ``"password"``,
            ``"email"`` for ``"email"``, ``"url"`` for ``"url"``, ``"tel"``
            for ``"phone"``, ``"off"`` for ``"search"``, and the empty string
            for ``"default"``. Pass an explicit token to override the default,
            or ``""`` to fall back to the browser's default autofill behavior
            (equivalent to not setting the attribute). For more details, see
            https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete

        on_change : callable
            An optional callback invoked when this text input's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            An optional string displayed when the text input is empty. If
            ``placeholder`` is ``None`` (default), the placeholder is derived
            from ``type`` (for example, ``you@example.com`` for
            ``type="email"``); for ``type="default"`` and ``type="password"``,
            no placeholder is displayed. Pass ``placeholder=""`` to force no
            placeholder even for a specialized type.

        disabled : bool
            An optional boolean that disables the text input if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.

        icon : str, None
            An optional emoji or icon to display within the input field to the
            left of the value. If ``icon`` is ``None`` (default), the icon is
            derived from ``type`` (for example, a mail icon for
            ``type="email"``); for ``type="default"`` and ``type="password"``,
            no icon is displayed. Pass ``icon=""`` to force no icon even for a
            specialized type. If ``icon`` is a non-empty string, the following
            options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

        validate : str, tuple[str, str], or None
            An optional client-side validation rule for the input. If this is
            ``None`` (default), no validation is performed for
            ``type="default"`` and ``type="password"``, while ``type="email"``
            and ``type="url"`` fall back to their built-in format validation.
            Pass ``validate=""`` to turn a specialized type's default
            validation off. If this is a string, it is treated as a
            JavaScript-flavored regular expression that the input must match
            before it can be submitted, and a generic error message is shown
            when validation fails. If this is a ``(regex, message)`` tuple, the
            regex is used for client-side validation and the custom ``message``
            is shown when validation fails. Providing a custom message is
            recommended, since generic validation messages are less helpful to
            users. A user-supplied ``validate`` replaces the type's default
            rule.

            For example, pass ``r"^[^@\s]+@[^@\s]+\.[^@\s]+$"`` to require an
            email-like value, or
            ``(r"^\d{3}-\d{3}-\d{4}$", "Use the format 555-123-4567.")`` to
            require a phone number and show a custom error message. Patterns are
            not implicitly anchored; use ``^`` / ``$`` when the whole value must
            match (same semantics as ``st.column_config.TextColumn``).

            Validation runs when the user tries to submit a value: on blur or
            Enter outside a form, and on form submission inside a form. Invalid
            values are not submitted, and empty inputs bypass validation.

            Inside a form with ``bind="query-params"``, keystrokes still stage
            the value into widget state (and therefore the URL) before
            submit-time validation runs. Form submission itself still blocks
            invalid values from reaching the server.

            .. note::
               This validation runs in the user's browser and can be bypassed.
               If the validation is security-relevant, you must also validate
               the value on the server (in your app code) after it is
               submitted.

        width : "stretch" or int
            The width of the text input widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        bind : "query-params" or None
            Binding mode for syncing the widget's value with a URL query
            parameter. If this is ``None`` (default), the widget's value
            is not synced to the URL. When this is set to
            ``"query-params"``, changes to the widget update the URL, and
            the widget can be initialized or updated through a query
            parameter in the URL. This requires ``key`` to be set. The
            key is used as the query parameter name.

            When the widget's value equals its default, the query
            parameter is removed from the URL to keep it clean. A bound
            query parameter can't be set or deleted through
            ``st.query_params``; it can only be programmatically changed
            through ``st.session_state``.

            This can't be used with ``type="password"``. An empty
            query parameter (e.g., ``?my_key=``) clears the widget.

        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            stops being rendered or the user switches pages. If this is
            ``"page"``, the value is preserved only while the user stays on the
            page where the widget is defined (for example, while the widget is
            conditionally hidden); it is discarded on a page switch and is not
            restored if the user returns to the page. If this is ``"session"``,
            the value is preserved for the entire session, including across
            page switches, so it returns when the user navigates back. This
            requires ``key`` to be set. If ``bind="query-params"`` is also set,
            the binding takes precedence: the value is stored in the URL, so it
            persists across page switches regardless of the ``persist_state``
            scope. For example,
            ``st.text_input("Name", key="name", persist_state="session")`` keeps
            the entered text when the widget is hidden and shown again, or when
            the user navigates to another page and back.

        Returns
        -------
        str or None
            The current value of the text input widget or ``None`` if no value has been
            provided by the user.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> title = st.text_input("Movie title", "Life of Brian")
        >>> st.write("The current movie title is", title)

        .. output::
           https://doc-text-input.streamlit.app/
           height: 260px

        Use a specialized ``type`` to get a matching native input, icon,
        placeholder, and validation with zero extra code:

        >>> import streamlit as st
        >>>
        >>> email = st.text_input("Email", type="email")
        >>> if email:
        ...     st.write("We'll reach you at", email)

        """
        ctx = get_script_run_ctx()
        return self._text_input(
            label=label,
            value=value,
            max_chars=max_chars,
            key=key,
            type=type,
            help=help,
            autocomplete=autocomplete,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            icon=icon,
            validate=validate,
            width=width,
            bind=bind,
            persist_state=persist_state,
            ctx=ctx,
        )

    def _text_input(
        self,
        label: str,
        value: SupportsStr | None = "",
        max_chars: int | None = None,
        key: Key | None = None,
        type: str = "default",
        help: str | None = None,
        autocomplete: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        validate: str | tuple[str, str] | None = None,
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        type_defaults = _TEXT_INPUT_TYPE_DEFAULTS.get(type)
        if type_defaults is None:
            raise StreamlitValueError(
                "type", [repr(t) for t in _TEXT_INPUT_TYPE_DEFAULTS]
            )

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None if value == "" else value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        # Make sure value is always string or None:
        value = str(value) if value is not None else None

        # Compute the widget identity from the RAW user-provided values, before
        # resolving any type-derived smart defaults below. `type` is already
        # part of the identity, so folding the type defaults (icon, placeholder,
        # validate, autocomplete) in here would needlessly reset every
        # pre-existing widget on upgrade. This is what keeps `type="default"`
        # and `type="password"` element IDs byte-for-byte unchanged.
        identity_validate_regex, _ = _parse_text_input_validate(validate)

        # Only contribute the validation regex to the element identity when
        # validation is actually configured. This keeps element IDs (and thus
        # widget state) stable across upgrades for the common case of inputs
        # without validation, instead of hashing a `validate=None` placeholder
        # that would reset every pre-existing text input on the first run after
        # upgrade. A falsy regex (`None` or `""`) is identity-neutral, matching
        # the frontend, which treats an empty regex as "no validation". When a
        # regex is set, it still affects identity so that changing the regex
        # resets the widget (its value may no longer be valid). The message is
        # intentionally excluded since it is cosmetic.
        validate_identity_kwarg = (
            {"validate": identity_validate_regex} if identity_validate_regex else {}
        )

        element_id = compute_and_register_element_id(
            "text_input",
            user_key=key,
            # Explicitly whitelist max_chars and validate so the ID changes when
            # they change, since the widget value might become invalid based on a
            # different max_chars or validation regex. Only the regex (not the
            # message) is used for identity, since the message is purely cosmetic.
            key_as_main_identity={"max_chars", "validate"},
            dg=self.dg,
            label=label,
            value=value,
            max_chars=max_chars,
            type=type,
            help=help,
            autocomplete=autocomplete,
            placeholder=str(placeholder),
            icon=icon,
            width=width,
            **validate_identity_kwarg,
        )

        # Resolve the effective values from the type defaults now that the
        # widget identity has been computed from the raw values above.
        # Precedence per property: explicit user value -> type default -> off.
        if icon is None:
            icon = type_defaults.icon
        elif icon == "":
            # `icon=""` opts out of the icon. Map it to None so it isn't passed
            # to `validate_icon_or_emoji`, which raises on an empty string.
            icon = None

        if placeholder is None:
            placeholder = type_defaults.placeholder

        # `validate=None` falls back to the type default (a no-op for
        # `default`/`password`, which define none); `validate=""` and explicit
        # values pass through unchanged. This effective regex is separate from
        # the identity regex above, which intentionally ignores the type
        # default so the default rule never enters the widget ID.
        effective_validate = type_defaults.validate if validate is None else validate
        validate_regex, validate_message = _parse_text_input_validate(
            effective_validate
        )

        if autocomplete is None:
            autocomplete = type_defaults.autocomplete

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_input_proto = TextInputProto()
        text_input_proto.id = element_id
        text_input_proto.label = label
        if value is not None:
            text_input_proto.default = value
        text_input_proto.form_id = current_form_id(self.dg)
        text_input_proto.disabled = disabled
        text_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            text_input_proto.help = dedent(help)

        if max_chars is not None:
            text_input_proto.max_chars = max_chars

        if placeholder is not None:
            text_input_proto.placeholder = str(placeholder)

        if icon is not None:
            text_input_proto.icon = validate_icon_or_emoji(icon)

        if validate_regex is not None:
            text_input_proto.validate_regex = validate_regex

        if validate_message is not None:
            text_input_proto.validate_message = validate_message

        text_input_proto.type = type_defaults.proto_type

        text_input_proto.autocomplete = autocomplete

        # Prevent binding password inputs to query params (exposes secrets in URL)
        if bind == "query-params" and type == "password":
            raise StreamlitAPIException(
                "Cannot use `bind='query-params'` with `type='password'`. "
                "Password values must not appear in URLs."
            )

        # Set query param key if bound
        if bind == "query-params" and key is not None:
            text_input_proto.query_param_key = str(key)

        serde = TextInputSerde(value, max_chars)

        widget_state = register_widget(
            text_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
            disabled=disabled,
            bind=bind,
            persist_state=persist_state,
            # Text input is clearable (empty string is a valid value)
            clearable=True,
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_input_proto.value = widget_state.value
            text_input_proto.set_value = True

        layout_config = create_layout_config(width=width)

        self.dg._enqueue(
            "text_input",
            text_input_proto,
            layout_config=layout_config,
            has_one_shot_effect=widget_state.value_changed,
        )
        return widget_state.value

    @overload
    def text_area(
        self,
        label: str,
        value: str = "",
        height: Height | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str:
        pass

    @overload
    def text_area(
        self,
        label: str,
        value: SupportsStr | None = None,
        height: Height | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str | None:
        pass

    @gather_metrics("text_area")
    def text_area(
        self,
        label: str,
        value: str | SupportsStr | None = "",
        height: Height | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> str | None:
        r"""Display a multi-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Common block-level Markdown (headings,
            lists, blockquotes) is automatically escaped and displays as
            literal text in labels.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        value : object or None
            The text value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user provides input. Defaults to empty string.

        height : "content", "stretch", int, or None
            The height of the text area widget. This can be one of the
            following:

            - ``None`` (default): The height of the widget fits three lines.
            - ``"content"``: The height of the widget matches the
              height of its content.
            - ``"stretch"``: The height of the widget matches the height of
              its content or the height of the parent container, whichever is
              larger. If the widget is not in a parent container, the height
              of the widget matches the height of its content.
            - An integer specifying the height in pixels: The widget has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled.

            The widget's height can't be smaller than the height of two lines.
            When ``label_visibility="collapsed"``, the minimum height is 68
            pixels. Otherwise, the minimum height is 98 pixels.

        max_chars : int or None
            Maximum number of characters allowed in text area.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``max_chars`` resets the widget even when a key
               is provided.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this text_area's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            An optional string displayed when the text area is empty. If None,
            no text is displayed.

        disabled : bool
            An optional boolean that disables the text area if set to ``True``.
            The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the text area widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        bind : "query-params" or None
            Binding mode for syncing the widget's value with a URL query
            parameter. If this is ``None`` (default), the widget's value
            is not synced to the URL. When this is set to
            ``"query-params"``, changes to the widget update the URL, and
            the widget can be initialized or updated through a query
            parameter in the URL. This requires ``key`` to be set. The
            key is used as the query parameter name.

            When the widget's value equals its default, the query
            parameter is removed from the URL to keep it clean. A bound
            query parameter can't be set or deleted through
            ``st.query_params``; it can only be programmatically changed
            through ``st.session_state``.

            An empty query parameter (e.g., ``?my_key=``) clears the
            widget.

        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            stops being rendered or the user switches pages. If this is
            ``"page"``, the value is preserved only while the user stays on the
            page where the widget is defined (for example, while the widget is
            conditionally hidden); it is discarded on a page switch and is not
            restored if the user returns to the page. If this is ``"session"``,
            the value is preserved for the entire session, including across
            page switches, so it returns when the user navigates back. This
            requires ``key`` to be set. If ``bind="query-params"`` is also set,
            the binding takes precedence: the value is stored in the URL, so it
            persists across page switches regardless of the ``persist_state``
            scope.

        Returns
        -------
        str or None
            The current value of the text area widget or ``None`` if no value has been
            provided by the user.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> txt = st.text_area(
        ...     "Text to analyze",
        ...     "It was the best of times, it was the worst of times, it was the age of "
        ...     "wisdom, it was the age of foolishness, it was the epoch of belief, it "
        ...     "was the epoch of incredulity, it was the season of Light, it was the "
        ...     "season of Darkness, it was the spring of hope, it was the winter of "
        ...     "despair, (...)",
        ... )
        >>>
        >>> st.write(f"You wrote {len(txt)} characters.")

        .. output::
           https://doc-text-area.streamlit.app/
           height: 300px

        """
        ctx = get_script_run_ctx()
        return self._text_area(
            label=label,
            value=value,
            height=height,
            max_chars=max_chars,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            width=width,
            bind=bind,
            persist_state=persist_state,
            ctx=ctx,
        )

    def _text_area(
        self,
        label: str,
        value: SupportsStr | None = "",
        height: Height | None = None,
        max_chars: int | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
        ctx: ScriptRunContext | None = None,
    ) -> str | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None if value == "" else value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        value = str(value) if value is not None else None

        element_id = compute_and_register_element_id(
            "text_area",
            user_key=key,
            # Explicitly whitelist max_chars to make sure the ID changes when it changes
            # since the widget value might become invalid based on a different max_chars
            key_as_main_identity={"max_chars"},
            dg=self.dg,
            label=label,
            value=value,
            height=height,
            max_chars=max_chars,
            help=help,
            placeholder=str(placeholder),
            width=width,
        )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        text_area_proto = TextAreaProto()
        text_area_proto.id = element_id
        text_area_proto.label = label
        if value is not None:
            text_area_proto.default = value
        text_area_proto.form_id = current_form_id(self.dg)
        text_area_proto.disabled = disabled
        text_area_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            text_area_proto.help = dedent(help)

        if max_chars is not None:
            text_area_proto.max_chars = max_chars

        if placeholder is not None:
            text_area_proto.placeholder = str(placeholder)

        # Set query param key if bound
        if bind == "query-params" and key is not None:
            text_area_proto.query_param_key = str(key)

        serde = TextAreaSerde(value, max_chars)
        widget_state = register_widget(
            text_area_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
            disabled=disabled,
            bind=bind,
            persist_state=persist_state,
            # Text area is clearable (empty string is a valid value)
            clearable=True,
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                text_area_proto.value = widget_state.value
            text_area_proto.set_value = True

        if height is None:
            # We want to maintain the same approximately three lines of text height
            # for the text input when the label is collapsed.
            # These numbers are for the entire element including the label and
            # padding.
            height = 122 if label_visibility != "collapsed" else 94

        layout_config = create_layout_config(
            width=width, height=height, allow_content_height=True
        )

        self.dg._enqueue(
            "text_area",
            text_area_proto,
            layout_config=layout_config,
            has_one_shot_effect=widget_state.value_changed,
        )
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
