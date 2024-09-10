# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import os
from typing import Any, Literal

from streamlit import util


class Error(Exception):
    """The base class for all exceptions thrown by Streamlit.

    Should be used for exceptions raised due to user errors (typically via
    StreamlitAPIException) as well as exceptions raised by Streamlit's internal
    code.
    """

    pass


class CustomComponentError(Error):
    """Exceptions thrown in the custom components code path."""

    pass


class DeprecationError(Error):
    pass


class FragmentStorageKeyError(Error, KeyError):
    """A KeyError raised when a KeyError is encountered during a FragmentStorage
    operation."""

    pass


class FragmentHandledException(Exception):
    """An exception that is raised by the fragment
    when it has handled the exception itself.
    """

    pass


class NoStaticFiles(Error):
    pass


class NoSessionContext(Error):
    pass


class MarkdownFormattedException(Error):
    """Exceptions with Markdown in their description.

    Instances of this class can use markdown in their messages, which will get
    nicely formatted on the frontend.
    """

    pass


class UncaughtAppException(Error):
    """Catchall exception type for uncaught exceptions that occur during script execution."""

    def __init__(self, exc):
        self.exc = exc


class StreamlitAPIException(MarkdownFormattedException):
    """Base class for Streamlit API exceptions.

    An API exception should be thrown when user code interacts with the
    Streamlit API incorrectly. (That is, when we throw an exception as a
    result of a user's malformed `st.foo` call, it should be a
    StreamlitAPIException or subclass.)

    When displaying these exceptions on the frontend, we strip Streamlit
    entries from the stack trace so that the user doesn't see a bunch of
    noise related to Streamlit internals.

    """

    def __repr__(self) -> str:
        return util.repr_(self)


class DuplicateWidgetID(StreamlitAPIException):
    pass


class StreamlitDuplicateElementId(DuplicateWidgetID):
    """An exception raised when the auto-generated ID of an element is not unique."""

    def __init__(self, element_type: str):
        super().__init__(
            f"There are multiple `{element_type}` elements with the same "
            "auto-generated ID. When this element is created, it is assigned an "
            "internal ID based on the element type and provided parameters. Multiple "
            "elements with the same type and parameters will cause this error.\n\n"
            "To fix this error, please pass a unique `key` argument to the "
            f"`{element_type}` element."
        )


class StreamlitDuplicateElementKey(DuplicateWidgetID):
    """An exception raised when the key of an element is not unique."""

    def __init__(self, user_key: str):
        super().__init__(
            f"There are multiple elements with the same `key='{user_key}'`. "
            "To fix this, please make sure that the `key` argument is unique for "
            "each element you create."
        )


class UnserializableSessionStateError(StreamlitAPIException):
    pass


class StreamlitAPIWarning(StreamlitAPIException, Warning):
    """Used to display a warning.

    Note that this should not be "raised", but passed to st.exception
    instead.
    """

    def __init__(self, *args):
        super().__init__(*args)
        import inspect
        import traceback

        f = inspect.currentframe()
        self.tacked_on_stack = traceback.extract_stack(f)

    def __repr__(self) -> str:
        return util.repr_(self)


class StreamlitModuleNotFoundError(StreamlitAPIWarning):
    """Print a pretty message when a Streamlit command requires a dependency
    that is not one of our core dependencies."""

    def __init__(self, module_name, *args):
        message = (
            f'This Streamlit command requires module "{module_name}" '
            "to be installed."
        )
        super().__init__(message, *args)


class LocalizableStreamlitException(StreamlitAPIException):
    def __init__(self, message: str, **kwargs):
        super().__init__((message).format(**kwargs))
        self._exec_kwargs = kwargs

    @property
    def exec_kwargs(self) -> dict[str, Any]:
        return self._exec_kwargs


# st.set_page_config
class StreamlitSetPageConfigMustBeFirstCommandError(LocalizableStreamlitException):
    """Exception raised when the set_page_config command is not the first executed streamlit command."""

    def __init__(self):
        super().__init__(
            "`set_page_config()` can only be called once per app page, "
            "and must be called as the first Streamlit command in your script.\n\n"
            "For more information refer to the [docs]"
            "(https://docs.streamlit.io/develop/api-reference/configuration/st.set_page_config)."
        )


class StreamlitInvalidPageLayoutError(LocalizableStreamlitException):
    """Exception raised when an invalid value is specified for layout."""

    def __init__(self, layout: str):
        super().__init__(
            '`layout` must be `"centered"` or `"wide"` (got `"{layout}"`)',
            layout=layout,
        )


class StreamlitInvalidSidebarStateError(LocalizableStreamlitException):
    """Exception raised when an invalid value is specified for `initial_sidebar_state`."""

    def __init__(self, initial_sidebar_state: str):
        super().__init__(
            '`initial_sidebar_state` must be `"auto"` or `"expanded"` or `"collapsed"` (got `"{initial_sidebar_state}"`)',
            initial_sidebar_state=initial_sidebar_state,
        )


class StreamlitInvalidMenuItemKeyError(LocalizableStreamlitException):
    """Exception raised when an invalid key is specified."""

    def __init__(self, key: str):
        super().__init__(
            'We only accept the keys: `"Get help"`, `"Report a bug"`, and `"About"` (`"{key}"` is not a valid key.)',
            key=key,
        )


class StreamlitInvalidURLError(LocalizableStreamlitException):
    """Exception raised when an invalid URL is specified for any of the menu items except for “About”."""

    def __init__(self, url: str):
        super().__init__(
            '"{url}" is a not a valid URL. '
            'You must use a fully qualified domain beginning with "http://", "https://", or "mailto:".',
            url=url,
        )


# st.columns
class StreamlitInvalidColumnSpecError(LocalizableStreamlitException):
    """Exception raised when no weights are specified, or a negative weight is specified."""

    def __init__(self):
        super().__init__(
            "The `spec` argument to `st.columns` must be either a "
            "positive integer (number of columns) or a list of positive numbers (width ratios of the columns). "
            "See [documentation](https://docs.streamlit.io/develop/api-reference/layout/st.columns) "
            "for more information."
        )


class StreamlitInvalidVerticalAlignmentError(LocalizableStreamlitException):
    """Exception raised when an invalid value is specified for vertical_alignment."""

    def __init__(self, vertical_alignment: str):
        super().__init__(
            'The `vertical_alignment` argument to `st.columns` must be `"top"`, `"center"`, or `"bottom"`. \n'
            "The argument passed was {vertical_alignment}.",
            vertical_alignment=vertical_alignment,
        )


class StreamlitInvalidColumnGapError(LocalizableStreamlitException):
    """Exception raised when an invalid value is specified for gap."""

    def __init__(self, gap: str):
        super().__init__(
            'The `gap` argument to `st.columns` must be `"small"`, `"medium"`, or `"large"`. \n'
            "The argument passed was {gap}.",
            gap=gap,
        )


# st.multiselect
class StreamlitSelectionCountExceedsMaxError(LocalizableStreamlitException):
    """Exception raised when there are more default selections specified than the max allowable selections."""

    def __init__(self, current_selections_count: int, max_selections_count: int):
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
    ):
        value_type = None
        min_value_type = None
        max_value_type = None
        step_type = None

        error_message = "All numerical arguments must be of the same type."

        if value:
            value_type = type(value).__name__
            error_message += "\n`value` has {value_type} type."

        if min_value:
            min_value_type = type(min_value).__name__
            error_message += "\n`min_value` has {min_value_type} type."

        if max_value:
            max_value_type = type(max_value).__name__
            error_message += "\n`max_value` has {max_value_type} type."

        if step:
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

    def __init__(self, value: int | float, min_value: int | float):
        super().__init__(
            "The `value` {value} is less than the `min_value` {min_value}.",
            value=value,
            min_value=min_value,
        )


class StreamlitValueAboveMaxError(LocalizableStreamlitException):
    """Exception raised when the `max_value` is less than the `value`."""

    def __init__(self, value: int | float, max_value: int | float):
        super().__init__(
            "The `value` {value} is greater than than the `max_value` {max_value}.",
            value=value,
            max_value=max_value,
        )


class StreamlitJSNumberBoundsError(LocalizableStreamlitException):
    """Exception raised when a number exceeds the Javascript limits."""

    def __init__(self, message: str):
        super().__init__(message)


class StreamlitInvalidNumberFormatError(LocalizableStreamlitException):
    """Exception raised when the format string for `st.number_input` contains
    invalid characters.
    """

    def __init__(self, format: str):
        super().__init__(
            "Format string for `st.number_input` contains invalid characters: {format}",
            format=format,
        )


# st.page_link
class StreamlitMissingPageLabelError(LocalizableStreamlitException):
    """Exception raised when a page_link is created without a label."""

    def __init__(self):
        super().__init__(
            "The `label` param is required for external links used with `st.page_link` - please provide a `label`."
        )


class StreamlitPageNotFoundError(LocalizableStreamlitException):
    """Exception raised the linked page can not be found."""

    def __init__(self, page: str, main_script_directory: str, is_mpa_v2: bool):
        directory = os.path.basename(main_script_directory)

        message = (
            "Could not find page: `{page}`. You must provide a file path "
            "relative to the entrypoint file (from the directory `{directory}`). "
            "Only the entrypoint file and files in the `pages/` directory are supported."
        )

        if is_mpa_v2:
            message = (
                "Could not find page: `{page}`. You must provide a `StreamlitPage` "
                "object or file path relative to the entrypoint file. Only pages "
                "previously defined by `st.Page` and passed to `st.navigation` are "
                "allowed."
            )

        super().__init__(
            message,
            page=page,
            directory=directory,
        )


# policies
class StreamlitFragmentWidgetsNotAllowedOutsideError(LocalizableStreamlitException):
    """Exception raised when the fragment attempts to write to an element outside of its container."""

    def __init__(self):
        super().__init__("Fragments cannot write widgets to outside containers.")


class StreamlitInvalidFormCallbackError(LocalizableStreamlitException):
    """Exception raised a `on_change` callback is set on any element in a form except for the `st.form_submit_button`."""

    def __init__(self):
        super().__init__(
            "Within a form, callbacks can only be defined on `st.form_submit_button`. "
            "Defining callbacks on other widgets inside a form is not allowed."
        )


class StreamlitValueAssignmentNotAllowedError(LocalizableStreamlitException):
    """Exception raised when trying to set values where writes are not allowed."""

    def __init__(self, key: str):
        super().__init__(
            "Values for the widget with `key` '{key}' cannot be set using `st.session_state`.",
            key=key,
        )


class StreamlitInvalidColorError(LocalizableStreamlitException):
    def __init__(self, color):
        super().__init__(
            "This does not look like a valid color: {color}.\n\n"
            "Colors must be in one of the following formats:"
            "* Hex string with 3, 4, 6, or 8 digits. Example: `'#00ff00'`"
            "* List or tuple with 3 or 4 components. Example: `[1.0, 0.5, 0, 0.2]`",
            color=repr(color),
        )


class StreamlitBadTimeStringError(LocalizableStreamlitException):
    """Exception Raised when a time string argument is passed that cannot be parsed."""

    def __init__(self, time_string: str):
        super().__init__(
            "Time string doesn't look right. It should be formatted as"
            "`'1d2h34m'` or `2 days`, for example. Got: {time_string}",
            time_string=time_string,
        )
