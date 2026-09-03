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

# ruff: noqa: RUF027 - We allow template strings in localizable exception messages instead of f-strings.

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, Literal

from streamlit import util

if TYPE_CHECKING:
    from collections.abc import Collection
    from datetime import date, time


class Error(Exception):  # pragma: no cover - trivial base class
    """The base class for all exceptions thrown by Streamlit.

    Should be used for exceptions raised due to user errors (typically via
    StreamlitAPIException) as well as exceptions raised by Streamlit's internal
    code.
    """


class StreamlitComponentRegistryError(Error):  # pragma: no cover - trivial subclass
    """Exceptions raised while discovering or registering Streamlit components.

    These errors occur during Streamlit startup when scanning installed
    distributions for component metadata and registering them with the component
    registry.
    """


class FragmentStorageKeyError(Error, KeyError):  # pragma: no cover - trivial subclass
    """A KeyError raised when a KeyError is encountered during a FragmentStorage
    operation.
    """


class FragmentHandledException(Exception):  # noqa: N818  # pragma: no cover - trivial subclass
    """An exception that is raised by the fragment
    when it has handled the exception itself.
    """


class NoSessionContext(Error):  # noqa: N818  # pragma: no cover - trivial subclass
    """Raised when a Streamlit command runs outside an active script session."""


class MarkdownFormattedException(Error):  # noqa: N818  # pragma: no cover - trivial subclass
    """Exceptions with Markdown in their description.

    Instances of this class can use markdown in their messages, which will get
    nicely formatted on the frontend.
    """


class StreamlitMaxRetriesError(Error):  # pragma: no cover - trivial subclass
    """An exception raised when a file or folder cannot be accessed after multiple retries."""


class StreamlitAPIException(MarkdownFormattedException):
    """Base class for Streamlit API exceptions.

    An API exception should be thrown when user code interacts with the
    Streamlit API incorrectly. (That is, when we throw an exception as a
    result of a user's malformed `st.foo` call, it should be a
    StreamlitAPIException or subclass.)

    When displaying these exceptions on the frontend, we strip Streamlit
    entries from the stack trace so that the user doesn't see a bunch of
    noise related to Streamlit internals.

    Prefer a more specific subclass when one fits. ``error_id`` is an optional
    stable telemetry identifier. When this base type is still right, pass a
    kebab-case ``error_id`` so uncaught-exception telemetry can distinguish
    error categories (``StreamlitAPIException:<error_id>``). Reuse the same id
    when the same error is raised from multiple sites.
    """

    def __init__(self, *args: Any, error_id: str | None = None) -> None:
        # Do not put widget keys, file paths, or free-text values in error_id.
        super().__init__(*args)
        self.error_id = error_id

    def __repr__(self) -> str:
        return util.repr_(self)


class StreamlitDataframeConversionError(StreamlitAPIException):
    """Raised when a value cannot be converted to a DataFrame or Arrow table."""


class DuplicateWidgetID(StreamlitAPIException):  # pragma: no cover - trivial subclass
    """Base class for duplicate element ID and key errors so ``except DuplicateWidgetID`` catches both."""


class StreamlitAuthError(StreamlitAPIException):  # pragma: no cover - trivial subclass
    """Raised when Streamlit authentication fails."""


class StreamlitMissingAuthlibError(StreamlitAuthError):
    """Raised when authentication features are used but Authlib is not installed
    (or is older than the minimum supported version).
    """

    def __init__(self) -> None:
        super().__init__(
            "Authentication requires Authlib>=1.3.2. "
            "Install it via `pip install streamlit[auth]`."
        )


class StreamlitDuplicateElementId(
    DuplicateWidgetID
):  # pragma: no cover - simple f-string
    """An exception raised when the auto-generated ID of an element is not unique."""

    def __init__(self, element_type: str) -> None:
        super().__init__(
            f"There are multiple `{element_type}` elements with the same "
            "auto-generated ID. When this element is created, it is assigned an "
            "internal ID based on the element type and provided parameters. Multiple "
            "elements with the same type and parameters will cause this error.\n\n"
            "To fix this error, please pass a unique `key` argument to the "
            f"`{element_type}` element."
        )


class StreamlitDuplicateElementKey(
    DuplicateWidgetID
):  # pragma: no cover - simple f-string
    """An exception raised when the key of an element is not unique."""

    def __init__(self, user_key: str) -> None:
        super().__init__(
            f"There are multiple elements with the same `key='{user_key}'`. "
            "To fix this, please make sure that the `key` argument is unique for "
            "each element you create."
        )


class UnserializableSessionStateError(
    StreamlitAPIException
):  # pragma: no cover - trivial subclass
    """Raised when a session state value cannot be pickled."""


class StreamlitAPIWarning(StreamlitAPIException, Warning):
    """Used to display a warning.

    Note that this should not be "raised", but passed to st.exception
    instead.
    """

    def __init__(self, *args: Any) -> None:
        super().__init__(*args)
        import inspect
        import traceback

        f = inspect.currentframe()
        self.tacked_on_stack = traceback.extract_stack(f)

    def __repr__(self) -> str:
        return util.repr_(self)


class LocalizableStreamlitException(StreamlitAPIException):
    """API exception with a format-string message and kwargs for localization.

    Users can localize the message from ``exec_kwargs``, for example in an
    ``on_script_error`` handler on ``st.App``. Kwargs are used for telemetry
    only in a few specific cases (for example ``parameter``). ``error_id`` is
    reserved for telemetry and is not interpolated into the message.
    """

    def __init__(self, message: str, **kwargs: Any) -> None:
        # Treat error_id as a telemetry slug, not a message placeholder:
        # extract it before formatting so it is not interpolated or stored
        # in exec_kwargs.
        error_id = kwargs.pop("error_id", None)
        super().__init__((message).format(**kwargs), error_id=error_id)
        self._exec_kwargs = kwargs

    @property
    def exec_kwargs(self) -> dict[str, Any]:
        return self._exec_kwargs


class StreamlitInvalidURLError(LocalizableStreamlitException):
    """Raised when a URL is malformed or uses an unsupported protocol."""

    def __init__(
        self,
        url: str,
        protocols: Collection[str] = ("http", "https", "mailto"),
    ) -> None:
        # mailto: has no authority component, so it is written as scheme:
        # rather than scheme://.
        prefixes = [
            f'"{protocol}:"' if protocol == "mailto" else f'"{protocol}://"'
            for protocol in protocols
        ]
        if len(prefixes) <= 2:
            protocols_text = " or ".join(prefixes)
        else:
            protocols_text = f"{', '.join(prefixes[:-1])}, or {prefixes[-1]}"
        super().__init__(
            '"{url}" is not a valid URL. '
            "You must use a fully qualified domain beginning with {protocols}.",
            url=url,
            protocols=protocols_text,
        )


# st.columns
class StreamlitInvalidColumnSpecError(LocalizableStreamlitException):
    """Exception raised when no weights are specified, or a negative weight is specified."""

    def __init__(self) -> None:
        super().__init__(
            "The `spec` argument to `st.columns` must be either a "
            "positive integer (number of columns) or a list of positive numbers (width ratios of the columns). "
            "See [documentation](https://docs.streamlit.io/develop/api-reference/layout/st.columns) "
            "for more information."
        )


# st.multiselect
class StreamlitSelectionCountExceedsMaxError(LocalizableStreamlitException):
    """Exception raised when there are more default selections specified than the max allowable selections."""

    def __init__(
        self, current_selections_count: int, max_selections_count: int
    ) -> None:
        super().__init__(
            "Multiselect has {current_selections_count} {current_selections_noun} "
            "selected but `max_selections` is set to {max_selections_count}. "
            "This happened because you either gave too many options to `default` "
            "or you manipulated the widget's state through `st.session_state`. "
            "Note that the latter can happen before the line indicated in the traceback. "
            "Please select at most {max_selections_count} {options_noun}.",
            current_selections_count=current_selections_count,
            current_selections_noun="option"
            if current_selections_count == 1
            else "options",
            max_selections_count=max_selections_count,
            options_noun="option" if max_selections_count == 1 else "options",
        )


# st.number_input
class StreamlitMixedNumericTypesError(LocalizableStreamlitException):
    """Exception raised mixing floats and ints in st.number_input."""

    def __init__(
        self,
        value: int | float | Literal["min"] | None,
        min_value: int | float | None,
        max_value: int | float | None,
        step: int | float | None,
    ) -> None:
        value_type = None
        min_value_type = None
        max_value_type = None
        step_type = None

        error_message = "All numerical arguments must be of the same type."

        if value is not None:
            value_type = type(value).__name__
            error_message += "\n`value` has {value_type} type."

        if min_value is not None:
            min_value_type = type(min_value).__name__
            error_message += "\n`min_value` has {min_value_type} type."

        if max_value is not None:
            max_value_type = type(max_value).__name__
            error_message += "\n`max_value` has {max_value_type} type."

        if step is not None:
            step_type = type(step).__name__
            error_message += "\n`step` has {step_type} type."

        super().__init__(
            error_message,
            value_type=value_type,
            min_value_type=min_value_type,
            max_value_type=max_value_type,
            step_type=step_type,
        )


class StreamlitValueBelowMinError(LocalizableStreamlitException):
    """Exception raised when the `min_value` is greater than the `value`."""

    def __init__(
        self,
        value: int | float | date | time,
        min_value: int | float | date | time,
    ) -> None:
        super().__init__(
            "The `value` {value} is less than the `min_value` {min_value}.",
            value=value,
            min_value=min_value,
        )


class StreamlitValueAboveMaxError(LocalizableStreamlitException):
    """Exception raised when the `max_value` is less than the `value`."""

    def __init__(
        self,
        value: int | float | date | time,
        max_value: int | float | date | time,
    ) -> None:
        super().__init__(
            "The `value` {value} is greater than the `max_value` {max_value}.",
            value=value,
            max_value=max_value,
        )


class StreamlitInvalidMinMaxError(LocalizableStreamlitException):
    """Raised when ``min_value`` is greater than ``max_value``.

    ``st.slider`` also raises this for equal bounds. ``st.date_input`` and
    ``st.datetime_input`` treat equal bounds as a valid single-day /
    single-instant range.
    """

    def __init__(self, min_value: object, max_value: object) -> None:
        if min_value == max_value:
            message = (
                "The `min_value` and `max_value` parameters are both set to "
                "{min_value}. They must not be equal."
            )
        else:
            message = (
                "The `min_value`, set to {min_value}, cannot be greater than "
                "the `max_value`, set to {max_value}."
            )
        super().__init__(
            message,
            min_value=min_value,
            max_value=max_value,
        )


class StreamlitValueOutOfRangeError(LocalizableStreamlitException):
    """Raised when a parameter is outside a closed ``[min, max]`` interval.

    Uncaught-exception telemetry appends the parameter name, for example
    ``StreamlitValueOutOfRangeError:index``. Optional ``detail`` appears in
    the error message only.
    """

    def __init__(
        self,
        parameter: str,
        value: object,
        min_value: object,
        max_value: object,
        *,
        detail: str | None = None,
    ) -> None:
        message = (
            "The `{parameter}` parameter, set to {value}, is outside the "
            "required range [{min_value}, {max_value}]."
        )
        if detail:
            message += " {detail}"
        super().__init__(
            message,
            parameter=parameter,
            value=value,
            min_value=min_value,
            max_value=max_value,
            detail=detail,
        )


class StreamlitJSNumberBoundsError(LocalizableStreamlitException):
    """Exception raised when a number exceeds the Javascript limits."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class StreamlitInvalidNumberFormatError(LocalizableStreamlitException):
    """Exception raised when the format string for `st.number_input` contains
    invalid characters.
    """

    def __init__(self, format: str) -> None:
        super().__init__(
            "Format string for `st.number_input` contains invalid characters: {format}",
            format=format,
        )


class StreamlitMissingRequiredParameterError(LocalizableStreamlitException):
    """Raised when a required parameter is missing, ``None``, or empty.

    Uncaught-exception telemetry appends the parameter name, for example
    ``StreamlitMissingRequiredParameterError:label``.
    """

    def __init__(self, parameter: str, *, detail: str | None = None) -> None:
        message = "The `{parameter}` parameter is required."
        if detail:
            message += " {detail}"
        super().__init__(
            message,
            parameter=parameter,
            detail=detail,
        )


class StreamlitIncompatibleParametersError(LocalizableStreamlitException):
    """Raised when two or more parameter uses cannot be combined.

    Describe each conflict as a string. Include ``parameter=value`` when the
    conflict depends on a value (for example ``wrap=False``); otherwise pass
    only the parameter name (for example ``on_change``). These strings appear
    only in the displayed error; uncaught-exception telemetry records only
    the exception type.
    """

    def __init__(
        self,
        first_use: str,
        second_use: str,
        *other_uses: str,
        explanation: str | None = None,
    ) -> None:
        uses = (first_use, second_use, *other_uses)
        quoted = [f"`{use}`" for use in uses]
        if len(quoted) == 2:
            uses_text = f"{quoted[0]} and {quoted[1]}"
        else:
            uses_text = ", ".join(quoted[:-1]) + f", and {quoted[-1]}"
        message = "{uses_text} cannot be used together."
        if explanation:
            message += " {explanation}"
        super().__init__(
            message,
            uses_text=uses_text,
            uses=list(uses),
            explanation=explanation,
        )


class StreamlitQueryParamDictValueError(LocalizableStreamlitException):
    """Exception raised when a query param value is a dictionary."""

    def __init__(self, key: str) -> None:
        super().__init__(
            "Query param value for `{key}` cannot be set to a dictionary. "
            "Provide a string or iterable of strings instead.",
            key=key,
        )


class StreamlitPageNotFoundError(LocalizableStreamlitException):
    """Raised when the linked page cannot be found."""

    def __init__(
        self,
        page: str,
        main_script_directory: str | None = None,
        uses_pages_directory: bool = False,
    ) -> None:
        if main_script_directory is None:
            super().__init__(
                "Unable to create Page. The file `{page}` could not be found.",
                page=page,
            )
            return

        directory = os.path.basename(main_script_directory)

        message = (
            "Could not find page: `{page}`. You must provide a `Page` "
            "object or file path relative to the entrypoint file. Only pages "
            "previously defined by `st.Page` and passed to `st.navigation` are "
            "allowed."
        )

        if uses_pages_directory:
            message = (
                "Could not find page: `{page}`. You must provide a file path "
                "relative to the entrypoint file (from the directory `{directory}`). "
                "Only the entrypoint file and files in the `pages/` directory are supported."
            )

        super().__init__(
            message,
            page=page,
            directory=directory,
        )


# Bidirectional Components
class BidiComponentError(
    LocalizableStreamlitException
):  # pragma: no cover - trivial base class
    """Base class for bidirectional (custom components v2) component errors.

    ``except BidiComponentError`` catches all specialized bidi errors.
    """


class BidiComponentInvalidIdError(BidiComponentError):
    """Exception raised when an invalid ID component is provided."""

    def __init__(self, part: str, delimiter: str) -> None:
        super().__init__(
            "The `{part}` of a bidirectional component's ID must not contain "
            "the delimiter sequence `{delimiter}`.",
            part=part,
            delimiter=delimiter,
        )


class BidiComponentInvalidCallbackNameError(BidiComponentError):
    """Exception raised when a callback with an invalid name is provided."""

    def __init__(self, callback_name: str) -> None:
        super().__init__(
            "The callback name `'{callback_name}'` is not allowed. "
            "Callback names must follow the pattern `on_{{event_name}}_change` "
            "where `event_name` is not empty.",
            callback_name=callback_name,
        )


class BidiComponentInvalidDefaultKeyError(BidiComponentError):
    """Exception raised when an invalid key is provided in the default dict."""

    def __init__(self, state_key: str, available_keys: list[str]) -> None:
        super().__init__(
            "Key `'{state_key}'` in `default` is not a valid state name. "
            "Valid state names are those with corresponding `on_{{state_name}}_change` "
            "callbacks. Available state names: `{available_keys}`",
            state_key=state_key,
            available_keys=available_keys or "none",
        )


class BidiComponentUnserializableDataError(BidiComponentError):
    """Exception raised when data provided to a bidirectional component cannot be serialized."""

    def __init__(self) -> None:
        super().__init__(
            "The `data` provided to the bidirectional component could not be serialized. "
            "Please ensure the data is JSON-serializable, or is a supported data structure "
            "like a pandas DataFrame."
        )


# policies
class StreamlitInvalidFormCallbackError(LocalizableStreamlitException):
    """Exception raised a `on_change` callback is set on any element in a form except for
    the `st.form_submit_button`.
    """

    def __init__(self) -> None:
        super().__init__(
            "Within a form, callbacks can only be defined on `st.form_submit_button`. "
            "Defining callbacks on other widgets inside a form is not allowed."
        )


class StreamlitInvalidLayoutContextError(StreamlitAPIException):
    """Raised when a command is used in a disallowed layout, form, or dialog context."""


class StreamlitValueAssignmentNotAllowedError(LocalizableStreamlitException):
    """Exception raised when trying to set values where writes are not allowed."""

    def __init__(self, key: str) -> None:
        super().__init__(
            "Values for the widget with `key` '{key}' cannot be set using `st.session_state`.",
            key=key,
        )


class StreamlitWidgetAlreadyInstantiatedError(LocalizableStreamlitException):
    """Raised when session state is assigned after the widget is created."""

    def __init__(self, key: str) -> None:
        super().__init__(
            "`st.session_state.{key}` cannot be modified after the widget"
            " with key `{key}` is instantiated.",
            key=key,
        )


class StreamlitInvalidColorError(LocalizableStreamlitException):
    """Raised when a color is not a valid hex string or RGB(A) sequence."""

    def __init__(
        self, color: str | Collection[Any] | tuple[int, int, int, int]
    ) -> None:
        super().__init__(
            "This does not look like a valid color: {color}.\n\n"
            "Colors must be in one of the following formats:\n\n"
            "* Hex string with 3, 4, 6, or 8 digits. Example: `'#00ff00'`\n"
            "* List or tuple with 3 or 4 components. Example: `[1.0, 0.5, 0, 0.2]`",
            color=repr(color),
        )


class StreamlitBadTimeStringError(LocalizableStreamlitException):
    """Exception Raised when a time string argument is passed that cannot be parsed."""

    def __init__(self, time_string: str) -> None:
        super().__init__(
            "Time string doesn't look right. It should be formatted as "
            "`'1d2h34m'` or `2 days`, for example. Got: {time_string}",
            time_string=time_string,
        )


class StreamlitSecretNotFoundError(
    LocalizableStreamlitException, FileNotFoundError
):  # pragma: no cover - trivial subclass
    """Exception raised when a secret cannot be found or a secrets source cannot be parsed."""


class StreamlitInvalidWidthError(LocalizableStreamlitException):
    """Exception raised when an invalid width value is provided."""

    def __init__(self, width: Any, allow_content: bool = False) -> None:
        valid_values = "a positive integer (pixels) or 'stretch'"
        if allow_content:
            valid_values = "a positive integer (pixels), 'stretch', or 'content'"

        super().__init__(
            "Invalid width value: {width}. Width must be either {valid_values}.",
            width=repr(width),
            valid_values=valid_values,
        )


class StreamlitInvalidHeightError(LocalizableStreamlitException):
    """Exception raised when an invalid height value is provided."""

    def __init__(self, height: Any, allow_content: bool = False) -> None:
        valid_values = "a positive integer (pixels) or 'stretch'"
        if allow_content:
            valid_values = "a positive integer (pixels), 'stretch', or 'content'"

        super().__init__(
            "Invalid height value: {height}. Height must be either {valid_values}.",
            height=repr(height),
            valid_values=valid_values,
        )


class StreamlitValueError(LocalizableStreamlitException):
    """Raised when a parameter receives a value outside a known set of options.

    ``valid_values`` is the user-facing list of supported values: Literal /
    enum-like options, or a short description of an open-ended constraint (for
    example ``a positive duration``). For a closed ``[min, max]`` interval,
    use ``StreamlitValueOutOfRangeError``. Uncaught-exception telemetry
    appends the parameter name, for example ``StreamlitValueError:width``.
    Optional ``detail`` appears in the error message only.
    """

    def __init__(
        self,
        parameter: str,
        valid_values: Collection[str],
        *,
        detail: str | None = None,
    ) -> None:
        message = "Invalid `{parameter}` value. Supported values: {valid_values}."
        if detail:
            message += " {detail}"
        super().__init__(
            message,
            parameter=parameter,
            valid_values=", ".join(valid_values),
            detail=detail,
        )


class StreamlitInvalidParameterTypeError(LocalizableStreamlitException):
    """Raised when a parameter has an unsupported type."""

    def __init__(
        self,
        parameter: str,
        provided_type: str,
        expected_types: list[str],
        *,
        detail: str | None = None,
    ) -> None:
        message = (
            "Invalid `{parameter}` type. Expected one of: {expected_types}. "
            "Provided type: {provided_type}."
        )
        if detail:
            message += " {detail}"
        super().__init__(
            message,
            parameter=parameter,
            expected_types=", ".join(expected_types),
            provided_type=provided_type,
            detail=detail,
        )


class StreamlitDefaultNotInOptionsError(LocalizableStreamlitException):
    """Raised when a default value is not among the provided options."""

    def __init__(self, value: Any) -> None:
        super().__init__(
            "The default value '{value}' is not part of the options. "
            "Please make sure that every default value also exists in the options.",
            value=value,
        )


# config
class StreamlitInvalidThemeError(LocalizableStreamlitException):
    """Base class for theme errors so ``except StreamlitInvalidThemeError`` also
    catches invalid option and section errors.
    """


class StreamlitInvalidThemeOptionError(
    StreamlitInvalidThemeError
):  # pragma: no cover - trivial subclass
    """Exception raised when an invalid theme config option is provided."""


class StreamlitInvalidThemeSectionError(StreamlitInvalidThemeError):
    """Exception raised when an invalid theme section is provided."""

    def __init__(self, option_name: str, file_path_or_url: str = "config.toml") -> None:
        super().__init__(
            "Invalid theme section: `{option_name}` found in {file_path_or_url}. "
            "Valid sections are: `theme`, `theme.light`, `theme.dark`, `theme.sidebar`, `theme.light.sidebar`, "
            "and `theme.dark.sidebar`.",
            option_name=option_name,
            file_path_or_url=file_path_or_url,
        )
