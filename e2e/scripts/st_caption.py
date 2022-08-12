import streamlit as st

sidebar_markdown = """# I am a header

## I am a subheader

### I am a subsubheader

I am some body text

[I am a link](https://google.com)

Foo `bar` baz"""

with st.sidebar:
    st.caption(sidebar_markdown)

st.caption("This is a caption!")
st.caption("This is a *caption* that contains **markdown inside it**!")
st.caption("This is a caption that contains <div>html</div> inside it!")
st.caption(
    "This is a caption that contains <div>html</div> inside it!", unsafe_allow_html=True
)
st.caption(
    """This is a caption that contains a bunch of interesting markdown:

# heading 1

## heading 2

### heading 3

#### heading 4

##### heading 5

###### heading 6

 * unordered list item 1
 * unordered list item 2
 * unordered list item 3

 1. ordered list item 1
 1. ordered list item 2
 1. ordered list item 3
"""
)
