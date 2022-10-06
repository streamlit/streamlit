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

from parameterized import parameterized

import streamlit as st
from tests import testutil


class EchoTest(testutil.DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            ("code_location default", lambda: st.echo(), 0, 1),
            ("code_location above", lambda: st.echo("above"), 0, 1),
            ("code_location below", lambda: st.echo("below"), 1, 0),
        ]
    )
    def test_echo(self, _, echo, echo_index, output_index):
        # The empty lines below are part of the test. Do not remove them.
        with echo():

            st.write("Hello")

            "hi"

            def foo(x):
                y = x + 10

                print(y)

            class MyClass(object):
                def do_x(self):
                    pass

                def do_y(self):
                    pass

        echo_str = """```python

st.write("Hello")

"hi"

def foo(x):
    y = x + 10

    print(y)

class MyClass(object):
    def do_x(self):
        pass

    def do_y(self):
        pass


```"""

        element = self.get_delta_from_queue(echo_index).new_element
        self.assertEqual(echo_str, element.markdown.body)

        element = self.get_delta_from_queue(output_index).new_element
        self.assertEqual("Hello", element.markdown.body)

        self.clear_queue()

    def test_root_level_echo(self):
        import tests.streamlit.echo_test_data.root_level_echo

        echo_str = """```python
a = 123


```"""

        element = self.get_delta_from_queue(0).new_element
        self.assertEqual(echo_str, element.markdown.body)
