# Copyright 2019 Streamlit Inc. All rights reserved.

"""exception_proto Unittest."""

import unittest

from streamlit.elements.exception_proto import _format_syntax_error_message


class ExceptionProtoTest(unittest.TestCase):
    def test_format_syntax_error_message(self):
        """Tests that format_syntax_error_message produces expected output"""
        err = SyntaxError(
            'invalid syntax',
            ('syntax_hilite.py', 84, 23, 'st.header(header_text))\n'))

        expected = """
File "syntax_hilite.py", line 84
  st.header(header_text))
                        ^
SyntaxError: invalid syntax
"""
        self.assertEqual(expected.strip(), _format_syntax_error_message(err))
