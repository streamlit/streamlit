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

import traceback
from pathlib import Path
from typing import TYPE_CHECKING, Final, cast

from streamlit import config
from streamlit.elements.lib.layout_utils import validate_width
from streamlit.errors import (
    Error,
    MarkdownFormattedException,
    StreamlitAPIWarning,
)
from streamlit.logger import get_logger
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
from streamlit.proto.WidthConfig_pb2 import WidthConfig
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent

# Installed Streamlit package root. UI traces hide frames under this directory,
# including bundled demos such as ``streamlit hello`` (``hello/*.py``). A
# Streamlit-only hello error falls back to the unfiltered stack; a third-party
# failure from hello keeps those library frames but drops the demo call site.
# Exempting ``hello/`` or the running script would special-case demos.
_STREAMLIT_PACKAGE_DIR: Final = Path(__file__).resolve().parent.parent

# Match CPython's ExceptionGroup formatting bounds (traceback.py).
_EXCEPTION_GROUP_MAX_DEPTH: Final = 10
_EXCEPTION_GROUP_MAX_WIDTH: Final = 15

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

        Examples
        --------
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
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)


# TODO(lawilby): confirm whether we want to track metrics here with lukasmasuch.
@gather_metrics("exception")
def _exception(
    dg: DeltaGenerator,
    exception: BaseException,
    width: WidthWithoutContent = "stretch",
    apply_show_error_details: bool = False,
) -> DeltaGenerator:
    exception_proto = ExceptionProto()
    marshall(
        exception_proto,
        exception,
        width,
        apply_show_error_details=apply_show_error_details,
    )
    return dg._enqueue("exception", exception_proto)


def marshall(
    exception_proto: ExceptionProto,
    exception: BaseException,
    width: WidthWithoutContent = "stretch",
    apply_show_error_details: bool = False,
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

    apply_show_error_details: bool
        Redact the message, type, and stack trace of the exception as the
        `client.showErrorDetails` config option requires. Set this for any
        exception that Streamlit itself sends to the browser, because the
        traceback can expose internal file paths.
    """
    validate_width(width)

    is_markdown_exception = isinstance(exception, MarkdownFormattedException)

    show_message, show_trace, show_type = _error_detail_visibility(
        apply_show_error_details
    )

    # Some exceptions (like UserHashError) have an alternate_name attribute so
    # we can pretend to the user that the exception is called something else.
    if getattr(exception, "alternate_name", None) is not None:
        exception_proto.type = exception.alternate_name  # type: ignore[attr-defined] # ty: ignore[unresolved-attribute]
    else:
        exception_proto.type = type(exception).__name__

    if show_trace:
        # Cause/context rows include type+message; honor show_message so
        # stacktrace mode cannot leak an inner exception message through
        # stack_trace. Skip construction entirely when the trace is hidden
        # (``type`` / ``none``) so redacted deployments do not pay for it.
        exception_proto.stack_trace.extend(
            _get_stack_trace_str_list(exception, include_exception_message=show_message)
        )
    exception_proto.is_warning = isinstance(exception, Warning)

    # Flag exceptions Streamlit itself raised (subclasses of streamlit.errors.Error)
    # so the frontend can scope the in-error "Install skills" callout to Streamlit
    # API misuse — the class of mistake the agent skills can actually fix — rather
    # than arbitrary user/runtime errors like ZeroDivisionError.
    exception_proto.is_streamlit_exception = isinstance(exception, Error)

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

    if apply_show_error_details:
        if not show_message:
            exception_proto.message = _GENERIC_UNCAUGHT_EXCEPTION_TEXT
        if not show_type:
            exception_proto.ClearField("type")
            # Provenance is only meaningful beside a visible type. With the type,
            # message and trace all withheld, the frontend has nothing to offer
            # help *about* — so don't let the in-error "install skills" callout
            # claim it can fix an error the box just refused to describe.
            exception_proto.ClearField("is_streamlit_exception")
        else:
            type_str = str(type(exception))
            exception_proto.type = type_str.replace("<class '", "").replace("'>", "")


def _error_detail_visibility(
    apply_show_error_details: bool,
) -> tuple[bool, bool, bool]:
    """Return ``(show_message, show_trace, show_type)`` for browser exceptions.

    ``st.exception()`` does not apply ``client.showErrorDetails``, so all three
    stay True. Uncaught exceptions honor the config, including the legacy
    ``False`` value still used by Community Cloud (equivalent to ``stacktrace``).
    """
    if not apply_show_error_details:
        return True, True, True

    show_error_details = config.get_option("client.showErrorDetails")
    show_message = (
        show_error_details == config.ShowErrorDetailsConfigOptions.FULL
        or config.ShowErrorDetailsConfigOptions.is_true_variation(show_error_details)
    )
    show_trace = (
        show_message
        or show_error_details == config.ShowErrorDetailsConfigOptions.STACKTRACE
        or config.ShowErrorDetailsConfigOptions.is_false_variation(show_error_details)
    )
    show_type = (
        show_trace or show_error_details == config.ShowErrorDetailsConfigOptions.TYPE
    )
    return show_message, show_trace, show_type


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


def _get_stack_trace_str_list(
    exception: BaseException, *, include_exception_message: bool = True
) -> list[str]:
    """Get the user-facing stack trace for the given exception.

    - Drop frames under the Streamlit package directory so runtime, cache, and
      widget internals do not clutter the traceback.
    - If the whole exception chain would then have no frames outside the
      Streamlit package, keep the original internals so Streamlit-only
      failures stay diagnosable. Third-party or stdlib frames count as
      user-facing evidence and skip that fallback.
    - Include chained exceptions (``raise X from Y`` / implicit ``__context__``).
      The frontend header only shows the outermost type and message, so each
      cause's type (and message, when ``include_exception_message``) is appended
      to its frames.
    """
    if isinstance(exception, StreamlitAPIWarning):
        frames = _filter_frames_with_fallback(exception.tacked_on_stack)
        return [item.strip() for item in traceback.format_list(frames)]

    return _format_traceback_rows(
        _user_facing_traceback_exception(exception),
        include_exception_line=False,
        include_exception_message=include_exception_message,
    )


def _is_under_dir(filename: str, directory: Path) -> bool:
    """True if ``filename`` resolves to a path inside ``directory``."""
    try:
        return Path(filename).resolve().is_relative_to(directory)
    except (OSError, ValueError, RuntimeError):
        # Keep the frame rather than hide one we cannot classify.
        # RuntimeError covers 3.10-3.12 pathlib turning symlink-loop ELOOP
        # into RuntimeError instead of OSError.
        return False


def _filter_frames_with_fallback(
    extracted_tb: traceback.StackSummary,
) -> list[traceback.FrameSummary]:
    """Drop Streamlit-internal frames, unless that would leave an empty traceback.

    A frame is internal if it lives under the Streamlit package directory.
    That stays correct when Streamlit is installed in a project-local venv
    (``.venv``), where package files sit under the user's app folder.

    Unlike ``_drop_streamlit_frames``, this never returns an empty list: a
    Streamlit-only stack is kept so internals stay diagnosable.
    """
    return _drop_streamlit_frames(extracted_tb) or list(extracted_tb)


def _drop_streamlit_frames(
    extracted_tb: traceback.StackSummary,
) -> list[traceback.FrameSummary]:
    """Drop Streamlit-internal frames. May return an empty list."""
    return [
        frame
        for frame in extracted_tb
        if not _is_under_dir(frame.filename, _STREAMLIT_PACKAGE_DIR)
    ]


def _user_facing_traceback_exception(
    exception: BaseException,
) -> traceback.TracebackException:
    """Build a TracebackException with Streamlit frames removed from the whole chain.

    The "keep internals if nothing remains" fallback applies to the chain, not
    each stack, and only when the filtered chain has no frames outside the
    Streamlit package. Third-party or stdlib frames count as user-facing
    evidence and skip the fallback — reconstructing "app vs library" would
    reopen the app-folder heuristic this module removes. A Streamlit-only
    ``__cause__`` / ``__context__`` (for example ``FileNotFoundError`` raised
    inside ``image_utils``) must not bring those frames back just because that
    one stack had no user code.
    """
    filtered = traceback.TracebackException.from_exception(exception)
    _filter_traceback_exception(filtered)
    if _traceback_has_frames(filtered):
        return filtered
    return traceback.TracebackException.from_exception(exception)


def _traceback_has_frames(tbe: traceback.TracebackException) -> bool:
    """True if any stack that ``_format_traceback_rows`` would emit still has frames.

    Walk ``__cause__`` in preference to ``__context__``, matching the
    formatter, so a frameless cause cannot let a hidden context skip the
    all-internal fallback.
    """
    if tbe.stack:
        return True
    if tbe.__cause__ is not None:
        if _traceback_has_frames(tbe.__cause__):
            return True
    elif (
        tbe.__context__ is not None
        and not tbe.__suppress_context__
        and _traceback_has_frames(tbe.__context__)
    ):
        return True
    # ExceptionGroup children exist on 3.11+ TracebackException as ``exceptions``.
    return any(
        _traceback_has_frames(sub) for sub in getattr(tbe, "exceptions", None) or ()
    )


def _filter_traceback_exception(tbe: traceback.TracebackException) -> None:
    """Remove Streamlit frames from this exception and every exception it chains to."""
    tbe.stack[:] = _drop_streamlit_frames(tbe.stack)
    if tbe.__cause__ is not None:
        _filter_traceback_exception(tbe.__cause__)
    if tbe.__context__ is not None:
        _filter_traceback_exception(tbe.__context__)
    # ExceptionGroup children exist on 3.11+ TracebackException as ``exceptions``.
    for sub in getattr(tbe, "exceptions", None) or ():
        _filter_traceback_exception(sub)


def _format_exception_only_rows(
    tbe: traceback.TracebackException, *, include_message: bool
) -> list[str]:
    """Format the exception-only trailer for a cause, context, or group child.

    When ``include_message`` is False (``client.showErrorDetails`` is
    ``stacktrace`` or legacy ``False``), emit only the type so inner messages
    cannot bypass header redaction via ``stack_trace``.
    """
    if include_message:
        return [
            line.rstrip("\n") for line in tbe.format_exception_only() if line.strip()
        ]
    # 3.13+ ``exc_type_str`` is module-qualified for non-builtins; older
    # ``exc_type.__name__`` is bare. Always emit the last dotted segment so
    # redacted traces do not differ by interpreter version.
    type_name = getattr(tbe, "exc_type_str", None) or tbe.exc_type.__name__
    return [type_name.rpartition(".")[2]]


def _format_traceback_rows(
    tbe: traceback.TracebackException,
    *,
    include_exception_line: bool,
    include_exception_message: bool,
    _group_depth: int = _EXCEPTION_GROUP_MAX_DEPTH,
    _group_width: int = _EXCEPTION_GROUP_MAX_WIDTH,
) -> list[str]:
    """Build traceback rows for chained exceptions without repeating the
    outermost type and message rendered by the frontend header.

    ``include_exception_line`` appends the exception's own ``Type: message``
    line after its frames. Causes, contexts, and group children need it
    because the frontend header shows only the outermost exception.
    """
    rows: list[str] = []
    chain_prefix: list[str] = []
    separator: str | None = None
    if tbe.__cause__ is not None:
        chain_prefix.extend(
            _format_traceback_rows(
                tbe.__cause__,
                include_exception_line=True,
                include_exception_message=include_exception_message,
                _group_depth=_group_depth,
                _group_width=_group_width,
            )
        )
        separator = (
            "The above exception was the direct cause of the following exception:"
        )
    elif tbe.__context__ is not None and not tbe.__suppress_context__:
        chain_prefix.extend(
            _format_traceback_rows(
                tbe.__context__,
                include_exception_line=True,
                include_exception_message=include_exception_message,
                _group_depth=_group_depth,
                _group_width=_group_width,
            )
        )
        separator = (
            "During handling of the above exception, another exception occurred:"
        )

    own_rows = [item.strip() for item in tbe.stack.format()]
    if include_exception_line:
        own_rows.extend(
            _format_exception_only_rows(tbe, include_message=include_exception_message)
        )

    rows.extend(chain_prefix)
    # Skip a dangling "following exception" sentence when this stack
    # contributes no frames and no exception line.
    if chain_prefix and own_rows and separator is not None:
        rows.append(separator)
    rows.extend(own_rows)

    children = getattr(tbe, "exceptions", None) or ()
    if children:
        if _group_depth <= 1:
            rows.append(f"... ({len(children)} ExceptionGroup child(ren) truncated)")
        else:
            shown = children[:_group_width]
            for i, child in enumerate(shown, start=1):
                rows.append(f"+---------------- {i} ----------------")
                rows.extend(
                    _format_traceback_rows(
                        child,
                        include_exception_line=True,
                        include_exception_message=include_exception_message,
                        _group_depth=_group_depth - 1,
                        _group_width=_group_width,
                    )
                )
            omitted = len(children) - len(shown)
            if omitted:
                rows.append(f"... and {omitted} more exception(s)")
    return rows
