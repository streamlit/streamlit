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

"""exception Unittest."""

import os
import traceback
import unittest
from pathlib import Path
from typing import cast
from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import errors
from streamlit.elements import exception
from streamlit.elements.exception import (
    _GENERIC_UNCAUGHT_EXCEPTION_TEXT,
    _STREAMLIT_PACKAGE_DIR,
    _filter_streamlit_frames,
    _format_syntax_error_message,
    _get_stack_trace_str_list,
    _is_under_dir,
)
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto
from tests import testutil
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields
from tests.streamlit.elements.support_files import exception_test_utils as user_module


class ExceptionProtoTest(unittest.TestCase):
    def test_format_syntax_error_message(self):
        """Tests that format_syntax_error_message produces expected output"""
        err = SyntaxError(
            "invalid syntax", ("syntax_hilite.py", 84, 23, "st.header(header_text))\n")
        )

        expected = """
File "syntax_hilite.py", line 84
  st.header(header_text))
                        ^
SyntaxError: invalid syntax
"""
        assert expected.strip() == _format_syntax_error_message(err)

    @parameterized.expand([(True,), (False,)])
    def test_markdown_flag(self, apply_show_error_details):
        """Test that ExceptionProtos for StreamlitAPIExceptions (and
        subclasses) have the "message_is_markdown" flag set.
        """
        proto = ExceptionProto()
        exception.marshall(
            proto,
            RuntimeError("oh no!"),
            apply_show_error_details=apply_show_error_details,
        )
        assert not proto.message_is_markdown

        proto = ExceptionProto()
        exception.marshall(
            proto,
            StreamlitAPIException("oh no!"),
            apply_show_error_details=apply_show_error_details,
        )
        assert proto.message_is_markdown

        proto = ExceptionProto()
        exception.marshall(
            proto,
            errors.DuplicateWidgetID("oh no!"),
            apply_show_error_details=apply_show_error_details,
        )
        assert proto.message_is_markdown

    @parameterized.expand(
        [
            (user_module.st_call_with_arguments_missing, "st.text()"),
            (user_module.st_call_with_bad_arguments, 'st.image("does not exist")'),
            (user_module.pandas_call_with_bad_arguments, None),
            (user_module.internal_python_call_with_bad_arguments, None),
        ]
    )
    def test_external_error_stack_excludes_streamlit_frames(
        self, user_func, expected_st_call
    ):
        """User-originated exceptions never include Streamlit package frames.

        The user's ``st.*`` call site stays (that line lives in their file).
        Library frames (pandas, the stdlib) stay; Streamlit runtime/widget
        internals do not.
        """
        err = None

        try:
            user_func()
        except Exception as e:
            err = e

        assert err is not None

        proto = ExceptionProto()
        exception.marshall(proto, cast("Exception", err), apply_show_error_details=True)

        user_module_dir = f"{Path(user_module.__file__).resolve().parent}{os.sep}"
        streamlit_pkg = f"{_STREAMLIT_PACKAGE_DIR.resolve()}{os.sep}"
        assert any(user_module_dir in t for t in proto.stack_trace), (
            f"User module missing from traceback: {proto.stack_trace}"
        )
        assert not any(streamlit_pkg in t for t in proto.stack_trace), (
            f"Streamlit internals leaked into user traceback: {proto.stack_trace}"
        )
        if expected_st_call is not None:
            assert any(expected_st_call in t for t in proto.stack_trace), (
                f"Triggering Streamlit call missing from traceback: {proto.stack_trace}"
            )

    def test_non_streamlit_traceback_is_kept(self):
        """An exception raised outside the Streamlit package keeps every frame."""
        err = None

        def func_with_error():
            raise RuntimeError("This function throws on purpose")

        try:
            func_with_error()
        except Exception as e:
            err = e

        assert err is not None

        original_stack_len = len(traceback.extract_tb(err.__traceback__))

        proto = ExceptionProto()
        exception.marshall(
            proto, cast("Exception", err), apply_show_error_details=False
        )

        user_module_dir = f"{Path(user_module.__file__).resolve().parent}{os.sep}"
        assert not any(user_module_dir in t for t in proto.stack_trace)
        assert len(proto.stack_trace) == original_stack_len, (
            f"Stack does not have length {original_stack_len}: {proto.stack_trace}"
        )

    @parameterized.expand([(True,), ("true",), ("True",), ("full",)])
    def test_uncaught_app_exception_show_everything(
        self, show_error_details_config_value
    ):
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details_config_value}
        ):
            err = None
            try:
                st.format("http://not_an_image.png", width=-1)
            except Exception as e:
                err = e
            assert err is not None

            # Marshall it.
            proto = ExceptionProto()
            exception.marshall(proto, err, apply_show_error_details=True)

            assert proto.message == "module 'streamlit' has no attribute 'format'"
            assert len(proto.stack_trace) > 0
            assert proto.type == "AttributeError"

    @parameterized.expand([(False,), ("false",), ("False",), ("stacktrace",)])
    def test_uncaught_app_exception_hide_message(self, show_error_details_config_value):
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details_config_value}
        ):
            err = None
            try:
                st.format("http://not_an_image.png", width=-1)
            except Exception as e:
                err = e
            assert err is not None

            # Marshall it.
            proto = ExceptionProto()
            exception.marshall(proto, err, apply_show_error_details=True)

            assert proto.message == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
            assert len(proto.stack_trace) > 0
            assert proto.type == "AttributeError"

    def test_uncaught_app_exception_show_type_and_stacktrace_only(self):
        with testutil.patch_config_options({"client.showErrorDetails": "stacktrace"}):
            err = None
            try:
                st.format("http://not_an_image.png", width=-1)
            except Exception as e:
                err = e
            assert err is not None

            # Marshall it.
            proto = ExceptionProto()
            exception.marshall(proto, err, apply_show_error_details=True)

            assert proto.message == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
            assert len(proto.stack_trace) > 0
            assert proto.type == "AttributeError"

    def test_uncaught_app_exception_show_only_type(self):
        with testutil.patch_config_options({"client.showErrorDetails": "type"}):
            err = None
            try:
                st.format("http://not_an_image.png", width=-1)
            except Exception as e:
                err = e
            assert err is not None

            # Marshall it.
            proto = ExceptionProto()
            exception.marshall(proto, err, apply_show_error_details=True)

            assert proto.message == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
            assert len(proto.stack_trace) == 0
            assert proto.type == "AttributeError"

    def test_uncaught_app_exception_hide_everything(self):
        with testutil.patch_config_options({"client.showErrorDetails": "none"}):
            err = None
            try:
                st.format("http://not_an_image.png", width=-1)
            except Exception as e:
                err = e
            assert err is not None

            # Marshall it.
            proto = ExceptionProto()
            exception.marshall(proto, err, apply_show_error_details=True)

            assert proto.message == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
            assert len(proto.stack_trace) == 0
            assert proto.type == ""


class ExceptionWidthTest(DeltaGeneratorTestCase):
    def test_exception_with_width_pixels(self):
        """Test that exceptions can be displayed with a specific width in pixels."""
        e = RuntimeError("This is an exception")
        st.exception(e, width=500)
        c = self.get_delta_from_queue().new_element.exception
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

    def test_exception_with_width_stretch(self):
        """Test that exceptions can be displayed with a width of 'stretch'."""
        e = RuntimeError("This is an exception")
        st.exception(e, width="stretch")
        c = self.get_delta_from_queue().new_element.exception
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_exception_with_default_width(self):
        """Test that the default width is used when not specified."""
        e = RuntimeError("This is an exception")
        st.exception(e)
        c = self.get_delta_from_queue().new_element.exception
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_exception_with_invalid_width(self):
        """Test that an invalid width raises an exception."""
        e = RuntimeError("This is an exception")
        with pytest.raises(StreamlitInvalidWidthError):
            st.exception(e, width="invalid")

    def test_exception_with_negative_width(self):
        """Test that a negative width raises an exception."""
        e = RuntimeError("This is an exception")
        with pytest.raises(StreamlitInvalidWidthError):
            st.exception(e, width=-100)


class StExceptionAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    @parameterized.expand([(True,), (False,)])
    def test_st_exception(self, show_error_details: bool):
        """Test st.exception."""
        # client.showErrorDetails has no effect on code that calls
        # st.exception directly. This test should have the same result
        # regardless of the config option.
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details}
        ):
            e = RuntimeError("Test Exception")
            st.exception(e)

            el = self.get_delta_from_queue().new_element
            assert el.exception.type == "RuntimeError"
            assert el.exception.message == "Test Exception"
            # We will test stack_trace when testing
            # streamlit.elements.exception_element
            assert el.exception.stack_trace == []


def test_marshall_with_alternate_name() -> None:
    """Test that alternate_name attribute is used as the exception type."""

    class CustomException(Exception):
        alternate_name = "PrettyErrorName"

    err = CustomException("something went wrong")
    proto = ExceptionProto()
    exception.marshall(proto, err)
    assert proto.type == "PrettyErrorName"


@pytest.mark.parametrize(
    ("show_error_details", "expected_type", "expected_flag"),
    [
        ("full", "streamlit.errors.StreamlitAPIException", True),
        ("stacktrace", "streamlit.errors.StreamlitAPIException", True),
        ("type", "streamlit.errors.StreamlitAPIException", True),
        # "none" withholds the type as well, leaving nothing to offer help about.
        ("none", "", False),
    ],
)
def test_marshall_is_streamlit_exception_follows_type_redaction(
    show_error_details: str, expected_type: str, expected_flag: bool
) -> None:
    """The provenance flag is withheld exactly when the type is.

    ``client.showErrorDetails="none"`` redacts the type, message and trace, so a
    surface keyed off this flag would otherwise offer to fix an error the box
    refused to describe. Every less-strict level keeps the flag, so redaction
    must not over-clear it either.
    """
    with testutil.patch_config_options({"client.showErrorDetails": show_error_details}):
        proto = ExceptionProto()
        exception.marshall(
            proto, StreamlitAPIException("boom"), apply_show_error_details=True
        )
        assert proto.type == expected_type
        assert proto.is_streamlit_exception is expected_flag


def test_marshall_is_streamlit_exception_survives_redaction_for_direct_calls() -> None:
    """``st.exception()`` is not an uncaught app exception, so redaction is moot.

    ``showErrorDetails`` only governs errors Streamlit caught itself; a direct
    call is the developer choosing to display something, so the flag stands even
    at the strictest level.
    """
    with testutil.patch_config_options({"client.showErrorDetails": "none"}):
        proto = ExceptionProto()
        exception.marshall(proto, StreamlitAPIException("boom"))
        assert proto.is_streamlit_exception is True


@pytest.mark.parametrize(
    ("err", "expected"),
    [
        (errors.Error("base"), True),
        (StreamlitAPIException("boom"), True),
        (errors.DuplicateWidgetID("dup"), True),
        (StreamlitInvalidWidthError("bad"), True),
        (ValueError("v"), False),
        (ZeroDivisionError(), False),
        (KeyError("k"), False),
    ],
)
def test_marshall_is_streamlit_exception(err: BaseException, expected: bool) -> None:
    """is_streamlit_exception is True only for streamlit.errors.Error subclasses.

    This flag scopes the in-error "Install skills" callout to Streamlit API
    misuse; arbitrary user/runtime errors must not set it.
    """
    proto = ExceptionProto()
    exception.marshall(proto, err)
    assert proto.is_streamlit_exception is expected


def test_marshall_is_streamlit_exception_ignores_alternate_name() -> None:
    """A non-Streamlit exception is not flagged even if it spoofs its type name.

    The flag is computed from the class (isinstance of streamlit.errors.Error),
    not the reported type string, so an ``alternate_name`` that mimics a
    Streamlit type cannot make a foreign error qualify.
    """

    class DuplicateWidgetID(Exception):  # Same name as a real Streamlit error.
        alternate_name = "DuplicateWidgetID"

    proto = ExceptionProto()
    exception.marshall(proto, DuplicateWidgetID("nope"))
    assert proto.type == "DuplicateWidgetID"
    assert proto.is_streamlit_exception is False


def test_marshall_syntax_error() -> None:
    """Test that SyntaxErrors are formatted with _format_syntax_error_message."""
    err = SyntaxError(
        "unexpected EOF",
        ("myfile.py", 10, 5, "print(\n"),
    )
    proto = ExceptionProto()
    exception.marshall(proto, err)
    assert "SyntaxError" in proto.message
    assert "myfile.py" in proto.message


def test_marshall_str_exception_raises() -> None:
    """Test that marshall handles exceptions whose __str__ raises."""

    class BadStrException(Exception):
        def __str__(self) -> str:
            raise RuntimeError("cannot convert to string")

    err = BadStrException()
    proto = ExceptionProto()
    exception.marshall(proto, err)
    assert proto.message == ""


def test_format_syntax_error_without_text() -> None:
    """Test _format_syntax_error_message fallback when text is None."""
    err = SyntaxError("encoding declaration in Unicode string")
    err.text = None
    result = _format_syntax_error_message(err)
    assert "encoding declaration" in result


def test_get_stack_trace_no_traceback() -> None:
    """An exception with no traceback produces an empty row list."""
    err = RuntimeError("no traceback")
    err.__traceback__ = None
    result = _get_stack_trace_str_list(err)
    assert result == []


def test_stack_trace_includes_cause() -> None:
    """Chained exceptions keep the cause's type and message in the UI traceback.

    The frontend header only shows the outermost exception, so without this
    the original error (the useful one, when Streamlit wraps a library failure)
    would disappear.
    """
    try:
        try:
            raise ValueError("root cause")
        except ValueError as err:
            raise RuntimeError("wrapper") from err
    except RuntimeError as err:
        rows = _get_stack_trace_str_list(err)

    joined = "\n".join(rows)
    assert "ValueError: root cause" in joined
    assert "direct cause" in joined
    assert "RuntimeError: wrapper" not in joined


def test_stack_trace_includes_implicit_context() -> None:
    """An implicit ``__context__`` is shown when there is no explicit cause."""
    try:
        try:
            raise ValueError("root")
        except ValueError:
            raise RuntimeError("wrapper")
    except RuntimeError as err:
        rows = _get_stack_trace_str_list(err)

    joined = "\n".join(rows)
    assert "ValueError: root" in joined
    assert "another exception occurred" in joined


def test_stack_trace_hides_context_when_raised_from_none() -> None:
    """``raise ... from None`` must not leak the suppressed context."""
    try:
        try:
            raise ValueError("hidden")
        except ValueError:
            raise RuntimeError("wrapper") from None
    except RuntimeError as err:
        rows = _get_stack_trace_str_list(err)

    joined = "\n".join(rows)
    assert "hidden" not in joined
    assert "another exception occurred" not in joined


def test_streamlit_only_context_keeps_message_not_frames() -> None:
    """A Streamlit-only ``__context__`` keeps its message, not its internals.

    ``st.image("does not exist")`` raises FileNotFoundError inside Streamlit,
    then a follow-on error. The user needs the file-not-found message and their
    ``st.image`` call, not ``image_utils`` frames.
    """
    try:
        user_module.st_call_with_bad_arguments()
    except Exception as err:
        rows = _get_stack_trace_str_list(err)

    joined = "\n".join(rows)
    streamlit_pkg = os.path.join(os.path.realpath(_STREAMLIT_PACKAGE_DIR), "")
    assert "does not exist" in joined
    assert 'st.image("does not exist")' in joined
    assert streamlit_pkg not in joined


def _frame(
    filename: str | Path, lineno: int = 1, name: str = "func", line: str = "code"
) -> traceback.FrameSummary:
    return traceback.FrameSummary(str(filename), lineno, name, line=line)


def _stack(*frames: traceback.FrameSummary) -> traceback.StackSummary:
    summary = traceback.StackSummary()
    summary.extend(frames)
    return summary


def test_filter_drops_streamlit_frames_between_user_frames() -> None:
    """Callbacks and cache wrappers leave Streamlit frames in the middle of the stack.

    Those internals are noise; the user wants their call site and their callback.
    """
    st_file = _STREAMLIT_PACKAGE_DIR / "runtime" / "scriptrunner" / "script_runner.py"
    user_file = Path("/tmp/user_app.py").resolve()

    filtered = _filter_streamlit_frames(
        _stack(
            _frame(st_file, 10, "exec_code"),
            _frame(user_file, 4, "main", "st.button('go', on_click=cb)"),
            _frame(st_file, 80, "call_callback"),
            _frame(user_file, 9, "cb", "1 / 0"),
        )
    )

    assert [f.filename for f in filtered] == [str(user_file), str(user_file)]
    assert [f.name for f in filtered] == ["main", "cb"]


def test_filter_keeps_streamlit_only_traceback() -> None:
    """Exceptions Streamlit raised with no user frames keep the internal stack."""
    st_file = _STREAMLIT_PACKAGE_DIR / "runtime" / "runtime.py"

    filtered = _filter_streamlit_frames(
        _stack(
            _frame(st_file, 10, "instance"),
            _frame(st_file, 20, "start"),
        )
    )

    assert [f.filename for f in filtered] == [str(st_file), str(st_file)]


def test_filter_keeps_user_file_outside_the_package_dir() -> None:
    """A user file outside the Streamlit package is kept; package frames are not."""
    st_file = _STREAMLIT_PACKAGE_DIR / "elements" / "image.py"
    user_file = (_STREAMLIT_PACKAGE_DIR.parent.parent / "app.py").resolve()

    filtered = _filter_streamlit_frames(
        _stack(
            _frame(st_file, 10, "exec_code"),
            _frame(user_file, 3, "<module>", 'st.image("missing.png")'),
            _frame(st_file, 186, "image"),
        )
    )

    assert [f.filename for f in filtered] == [str(user_file)]


def test_is_under_dir_returns_false_on_resolve_error() -> None:
    """Unresolvable frame paths are treated as not inside the package."""
    with patch.object(Path, "resolve", side_effect=OSError("boom")):
        assert _is_under_dir("whatever.py", _STREAMLIT_PACKAGE_DIR) is False
