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

import os
import traceback
from typing import TYPE_CHECKING, Final, TypeVar, cast

from streamlit import config
from streamlit.elements.lib.layout_utils import validate_width
from streamlit.errors import (
    MarkdownFormattedException,
    StreamlitAPIWarning,
)
from streamlit.logger import get_logger
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
from streamlit.proto.WidthConfig_pb2 import WidthConfig
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent

_LOGGER: Final = get_logger(__name__)

# When client.showErrorDetails is False, we show a generic warning in the
# frontend when we encounter an uncaught app exception.
_GENERIC_UNCAUGHT_EXCEPTION_TEXT: Final = (
    "This app has encountered an error. The original error message is redacted "
    "to prevent data leaks. Full error details have been recorded in the logs "
    "(if you're on Streamlit Cloud, click on 'Manage app' in the lower right of your app)."
)


class ExceptionMixin:
    @gather_metrics("exception")
    def exception(
        self, exception: BaseException, width: WidthWithoutContent = "stretch"
    ) -> DeltaGenerator:
        """Display an exception.

        When accessing the app through ``localhost``, in the lower-right corner
        of the exception, Streamlit displays links to Google and ChatGPT that
        are prefilled with the contents of the exception message.

        Parameters
        ----------
        exception : Exception
            The exception to display.
        width : "stretch" or int
            The width of the exception element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> e = RuntimeError("This is an exception of type RuntimeError")
        >>> st.exception(e)

        .. output::
            https://doc-status-exception.streamlit.app/
            height: 220px

        """
        return _exception(self.dg, exception, width=width)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


# TODO(lawilby): confirm whether we want to track metrics here with lukasmasuch.
@gather_metrics("exception")
def _exception(
    dg: DeltaGenerator,
    exception: BaseException,
    width: WidthWithoutContent = "stretch",
    is_uncaught_app_exception: bool = False,
) -> DeltaGenerator:
    exception_proto = ExceptionProto()
    marshall(exception_proto, exception, width, is_uncaught_app_exception)
    return dg._enqueue("exception", exception_proto)


def marshall(
    exception_proto: ExceptionProto,
    exception: BaseException,
    width: WidthWithoutContent = "stretch",
    is_uncaught_app_exception: bool = False,
) -> None:
    """Marshalls an Exception.proto message.

    Parameters
    ----------
    exception_proto : Exception.proto
        The Exception protobuf to fill out.

    exception : BaseException
        The exception whose data we're extracting.

    width : int or "stretch"
        The width of the exception display. Can be either an integer (pixels) or "stretch".
        Defaults to "stretch".

    is_uncaught_app_exception: bool
        The exception originates from an uncaught error during script execution.
    """
    validate_width(width)

    is_markdown_exception = isinstance(exception, MarkdownFormattedException)

    # Some exceptions (like UserHashError) have an alternate_name attribute so
    # we can pretend to the user that the exception is called something else.
    if getattr(exception, "alternate_name", None) is not None:
        exception_proto.type = exception.alternate_name  # type: ignore[attr-defined]
    else:
        exception_proto.type = type(exception).__name__

    stack_trace = _get_stack_trace_str_list(exception)

    exception_proto.stack_trace.extend(stack_trace)
    exception_proto.is_warning = isinstance(exception, Warning)

    width_config = WidthConfig()

    if isinstance(width, int):
        width_config.pixel_width = width
    else:
        width_config.use_stretch = True

    exception_proto.width_config.CopyFrom(width_config)

    try:
        if isinstance(exception, SyntaxError):
            # SyntaxErrors have additional fields (filename, text, lineno,
            # offset) that we can use for a nicely-formatted message telling
            # the user what to fix.
            exception_proto.message = _format_syntax_error_message(exception)
        else:
            exception_proto.message = str(exception).strip()
            exception_proto.message_is_markdown = is_markdown_exception

    except Exception as str_exception:
        # Sometimes the exception's __str__/__unicode__ method itself
        # raises an error.
        exception_proto.message = ""
        _LOGGER.warning(
            """

Streamlit was unable to parse the data from an exception in the user's script.
This is usually due to a bug in the Exception object itself. Here is some info
about that Exception object, so you can report a bug to the original author:

Exception type:
  %s

Problem:
  %s

Traceback:
%s

        """,
            type(exception).__name__,
            str_exception,
            "\n".join(_get_stack_trace_str_list(str_exception)),
        )

    if is_uncaught_app_exception:
        show_error_details = config.get_option("client.showErrorDetails")

        show_message = (
            show_error_details == config.ShowErrorDetailsConfigOptions.FULL
            or config.ShowErrorDetailsConfigOptions.is_true_variation(
                show_error_details
            )
        )
        # False is a legacy config option still in-use in community cloud. It is equivalent
        # to "stacktrace".
        show_trace = (
            show_message
            or show_error_details == config.ShowErrorDetailsConfigOptions.STACKTRACE
            or config.ShowErrorDetailsConfigOptions.is_false_variation(
                show_error_details
            )
        )
        show_type = (
            show_trace
            or show_error_details == config.ShowErrorDetailsConfigOptions.TYPE
        )

        if not show_message:
            exception_proto.message = _GENERIC_UNCAUGHT_EXCEPTION_TEXT
        if not show_type:
            exception_proto.ClearField("type")
        else:
            type_str = str(type(exception))
            exception_proto.type = type_str.replace("<class '", "").replace("'>", "")
        if not show_trace:
            exception_proto.ClearField("stack_trace")


def _format_syntax_error_message(exception: SyntaxError) -> str:
    """Returns a nicely formatted SyntaxError message that emulates
    what the Python interpreter outputs.

    For example:

    > File "raven.py", line 3
    >   st.write('Hello world!!'))
    >                            ^
    > SyntaxError: invalid syntax

    """
    if exception.text:
        caret_indent = (
            " " * max(exception.offset - 1, 0) if exception.offset is not None else ""
        )

        return (
            f'File "{exception.filename}", line {exception.lineno}\n'
            f"  {exception.text.rstrip()}\n"
            f"  {caret_indent}^\n"
            f"{type(exception).__name__}: {exception.msg}"
        )
    # If a few edge cases, SyntaxErrors don't have all these nice fields. So we
    # have a fall back here.
    # Example edge case error message: encoding declaration in Unicode string
    return str(exception)


def _get_stack_trace_str_list(exception: BaseException) -> list[str]:
    """Get the stack trace for the given exception.

    Parameters
    ----------
    exception : BaseException
        The exception to extract the traceback from

    Returns
    -------
    tuple of two string lists
        The exception traceback as two lists of strings. The first represents the part
        of the stack trace the users don't typically want to see, containing internal
        Streamlit code. The second is whatever comes after the Streamlit stack trace,
        which is usually what the user wants.

    """
    extracted_traceback: traceback.StackSummary | None = None
    if isinstance(exception, StreamlitAPIWarning):
        extracted_traceback = exception.tacked_on_stack
    elif hasattr(exception, "__traceback__"):
        extracted_traceback = traceback.extract_tb(exception.__traceback__)

    # Format the extracted traceback and add it to the protobuf element.
    if extracted_traceback is None:
        trace_str_list = [
            "Cannot extract the stack trace for this exception. "
            "Try calling exception() within the `catch` block."
        ]
    else:
        internal_frames, external_frames = _split_internal_streamlit_frames(
            extracted_traceback
        )

        if external_frames:
            trace_str_list = traceback.format_list(external_frames)
        else:
            trace_str_list = traceback.format_list(internal_frames)

        trace_str_list = [item.strip() for item in trace_str_list]

    return trace_str_list


def _is_in_package(file: str, package_path: str) -> bool:
    """True if the given file is part of package_path."""
    try:
        common_prefix = os.path.commonprefix([os.path.realpath(file), package_path])
    except ValueError:
        # Raised if paths are on different drives.
        return False

    return common_prefix == package_path


def _split_internal_streamlit_frames(
    extracted_tb: traceback.StackSummary,
) -> tuple[list[traceback.FrameSummary], list[traceback.FrameSummary]]:
    """Split the traceback into a Streamlit-internal part and an external part.

    The internal part is everything up to (but excluding) the first frame belonging to
    the user's code. The external part is everything else.

    So if the stack looks like this:

        1. Streamlit frame
        2. Pandas frame
        3. Altair frame
        4. Streamlit frame
        5. User frame
        6. User frame
        7. Streamlit frame
        8. Matplotlib frame

    ...then this should return 1-4 as the internal traceback and 5-8 as the external.

    (Note that something like the example above is extremely unlikely to happen since
    it's not like Altair is calling Streamlit code, but you get the idea.)
    """

    ctx = get_script_run_ctx()

    if not ctx:
        return [], list(extracted_tb)

    package_path = os.path.join(os.path.realpath(str(ctx.main_script_parent)), "")

    return _split_list(
        extracted_tb,
        split_point=lambda tb: _is_in_package(tb.filename, package_path),
    )


T = TypeVar("T")


def _split_list(
    orig_list: list[T], split_point: Callable[[T], bool]
) -> tuple[list[T], list[T]]:
    before: list[T] = []
    after: list[T] = []

    saw_split_point = False

    for item in orig_list:
        if not saw_split_point and split_point(item):
            saw_split_point = True

        if saw_split_point:
            after.append(item)
        else:
            before.append(item)

    return before, after
