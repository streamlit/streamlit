"""
Test script for custom LaTeX delimiters feature.
This will work once protobufs are rebuilt with: make protobuf
"""
import streamlit as st

st.title("Custom LaTeX Delimiters Test")

st.header("1. Default Delimiters ($ and $$)")
st.markdown("Inline math: $x^2 + y^2 = z^2$")
st.markdown("Block math:\n$$\n\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$")

st.header("2. OpenAI/ChatGPT Delimiters (\\( \\) and \\[ \\])")
st.markdown(
    "Inline math: \\(x^2 + y^2 = z^2\\) and more: \\(E = mc^2\\)",
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)

st.markdown(
    "Block math:\n\\[\n\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\\]",
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)

st.header("3. Test with st.caption()")
st.caption(
    "Caption with custom delimiters: \\(\\alpha + \\beta\\)",
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)

st.header("4. Mixed content")
st.markdown(
    """
    This is a paragraph with inline math \\(a^2 + b^2 = c^2\\) 
    and **bold text** and `code`.
    
    Here's a block equation:
    \\[
    \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
    \\]
    """,
    latex_delimiters=((r"\(", r"\)"), (r"\[", r"\]"))
)

st.success("✅ If you see properly rendered LaTeX above, the feature works!")
