"""LaTeX unit test."""

from tests import testutil
import streamlit as st


class LatexTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall latex protos."""

    def test_latex(self):
        st.latex("ax^2 + bx + c = 0")

        c = self.get_delta_from_queue().new_element.markdown
        self.assertEqual(c.body, "$$\nax^2 + bx + c = 0\n$$")

    def test_sympy_expression(self):
        try:
            import sympy

            a, b = sympy.symbols("a b")
            out = a + b
        except:
            out = "a + b"

        st.latex(out)

        c = self.get_delta_from_queue().new_element.markdown
        self.assertEqual(c.body, "$$\na + b\n$$")
