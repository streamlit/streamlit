from parameterized import parameterized

from tests import testutil
import streamlit as st


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
