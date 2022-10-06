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

"""exception Unittest."""
import os
import unittest

import streamlit as st
from streamlit import errors
from streamlit.elements import exception
from streamlit.elements.exception import (
    _GENERIC_UNCAUGHT_EXCEPTION_TEXT,
    _format_syntax_error_message,
)
from streamlit.errors import StreamlitAPIException, UncaughtAppException
from streamlit.proto.Exception_pb2 import Exception as ExceptionProto


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
        self.assertEqual(expected.strip(), _format_syntax_error_message(err))

    def test_markdown_flag(self):
        """Test that ExceptionProtos for StreamlitAPIExceptions (and
        subclasses) have the "message_is_markdown" flag set.
        """
        proto = ExceptionProto()
        exception.marshall(proto, RuntimeError("oh no!"))
        self.assertFalse(proto.message_is_markdown)

        proto = ExceptionProto()
        exception.marshall(proto, StreamlitAPIException("oh no!"))
        self.assertTrue(proto.message_is_markdown)

        proto = ExceptionProto()
        exception.marshall(proto, errors.DuplicateWidgetID("oh no!"))
        self.assertTrue(proto.message_is_markdown)

    def test_strip_streamlit_stack_entries(self):
        """Test that StreamlitAPIExceptions don't include Streamlit entries
        in the stack trace.

        """
        # Create a StreamlitAPIException.
        err = None
        try:
            st.image("http://not_an_image.png", width=-1)
        except StreamlitAPIException as e:
            err = e
        self.assertIsNotNone(err)

        # Marshall it.
        proto = ExceptionProto()
        exception.marshall(proto, err)

        # The streamlit package should not appear in any stack entry.
        streamlit_dir = os.path.dirname(st.__file__)
        streamlit_dir = os.path.join(os.path.realpath(streamlit_dir), "")
        for line in proto.stack_trace:
            self.assertNotIn(streamlit_dir, line, "Streamlit stack entry not stripped")

    def test_uncaught_app_exception(self):
        err = None
        try:
            st.format("http://not_an_image.png", width=-1)
        except Exception as e:
            err = UncaughtAppException(e)
        self.assertIsNotNone(err)

        # Marshall it.
        proto = ExceptionProto()
        exception.marshall(proto, err)

        for line in proto.stack_trace:
            # assert message that could contain secret information in the stack trace
            assert "module 'streamlit' has no attribute 'format'" not in line

        assert proto.message == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
        assert proto.type == "AttributeError"
