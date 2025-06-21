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

"""exception Unittest."""

import os
import traceback
import unittest
from pathlib import Path
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import errors
from streamlit.elements import exception
from streamlit.elements.exception import (
    _GENERIC_UNCAUGHT_EXCEPTION_TEXT,
    _format_syntax_error_message,
    _split_list,
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
    def test_markdown_flag(self, is_uncaught_app_exception):
        """Test that ExceptionProtos for StreamlitAPIExceptions (and
        subclasses) have the "message_is_markdown" flag set.
        """
        proto = ExceptionProto()
        exception.marshall(
            proto,
            RuntimeError("oh no!"),
            is_uncaught_app_exception=is_uncaught_app_exception,
        )
        assert not proto.message_is_markdown

        proto = ExceptionProto()
        exception.marshall(
            proto,
            StreamlitAPIException("oh no!"),
            is_uncaught_app_exception=is_uncaught_app_exception,
        )
        assert proto.message_is_markdown

        proto = ExceptionProto()
        exception.marshall(
            proto,
            errors.DuplicateWidgetID("oh no!"),
            is_uncaught_app_exception=is_uncaught_app_exception,
        )
        assert proto.message_is_markdown

    @parameterized.expand(
        [
            (user_module.st_call_with_arguments_missing, 2),
            (user_module.st_call_with_bad_arguments, 7),
            (user_module.pandas_call_with_bad_arguments, 2),
            (user_module.internal_python_call_with_bad_arguments, 2),
        ]
    )
    @patch("streamlit.elements.exception.get_script_run_ctx")
    def test_external_error_stack_starts_with_user_module(
        self, user_func, stack_len, patched_get_script_run_ctx
    ):
        """Test stack traces for exceptions thrown by user code start from the first
        line of user code.

        """
        ctx = MagicMock()
        user_module_path = Path(user_module.__file__).parent
        ctx.main_script_parent = user_module_path
        patched_get_script_run_ctx.return_value = ctx

        err = None

        try:
            user_func()
        except Exception as e:
            err = e

        assert err is not None

        # Marshall it.
        proto = ExceptionProto()
        exception.marshall(
            proto, cast("Exception", err), is_uncaught_app_exception=True
        )

        user_module_path = os.path.join(os.path.realpath(user_module_path), "")
        assert user_module_path in proto.stack_trace[0], "Stack not stripped"
        assert len(proto.stack_trace) == stack_len, (
            f"Stack does not have length {stack_len}: {proto.stack_trace}"
        )

    @patch("streamlit.elements.exception.get_script_run_ctx")
    def test_internal_error_stack_doesnt_start_with_user_module(
        self, patched_get_script_run_ctx
    ):
        """Test stack traces for exceptions thrown by Streamlit code *not* called by the
        user.

        """
        ctx = MagicMock()
        user_module_path = Path(user_module.__file__).parent
        ctx.main_script_parent = user_module_path
        patched_get_script_run_ctx.return_value = ctx

        err = None

        def func_with_error():
            raise RuntimeError("This function throws on purpose")

        try:
            func_with_error()
        except Exception as e:
            err = e

        assert err is not None

        original_stack_len = len(traceback.extract_tb(err.__traceback__))

        # Marshall it.
        proto = ExceptionProto()
        exception.marshall(
            proto, cast("Exception", err), is_uncaught_app_exception=False
        )

        user_module_path = os.path.join(os.path.realpath(user_module_path), "")
        assert not any(user_module_path in t for t in proto.stack_trace)
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
            exception.marshall(proto, err, is_uncaught_app_exception=True)

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
            exception.marshall(proto, err, is_uncaught_app_exception=True)

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
            exception.marshall(proto, err, is_uncaught_app_exception=True)

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
            exception.marshall(proto, err, is_uncaught_app_exception=True)

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
            exception.marshall(proto, err, is_uncaught_app_exception=True)

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


class SplitListTest(unittest.TestCase):
    @parameterized.expand(
        [
            (["a", "b", "c", "-", "d", "e"], 3),
            (["-", "a", "b", "c", "d", "e"], 0),
            (["a", "b", "c", "d", "e", "-"], 5),
            (["a", "b", "c", "d", "e", "f"], 100),
            (["a", "-", "c", "d", "-", "f"], 1),
            ([], 100),
        ]
    )
    def test_split_list(self, input_list, split_index):
        before, after = _split_list(input_list, split_point=lambda x: x == "-")

        assert before == input_list[:split_index]
        assert after == input_list[split_index:]
