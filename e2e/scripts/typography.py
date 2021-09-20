import streamlit as st


def draw_header_test(join_output):
    strings = [
        "# Header header",
        "## Header header",
        "### Header header",
        "#### Header header",
        "##### Header header",
        "###### Header header",
        "Quisque vel blandit mi. Fusce dignissim leo purus, in imperdiet lectus suscipit nec.",
    ]

    if join_output:
        st.write("\n\n".join(strings))
    else:
        for string in strings:
            st.write(string)


draw_header_test(True)

with st.sidebar:
    st.text_input("This is a label", key="1")
    draw_header_test(True)

"---"

st.text("Headers in single st.markdown")
draw_header_test(True)

"---"

st.text("Headers in multiple st.markdown")
draw_header_test(False)

"---"

st.text("Headers in columns")

a, b = st.columns(2)

with a:
    draw_header_test(True)

with b:
    draw_header_test(False)

"---"

st.text("Headers in columns with other elements above")

a, b = st.columns(2)

with a:
    st.text("This is some text")
    draw_header_test(True)

with b:
    st.text("This is some text")
    with st.container():
        draw_header_test(False)

"---"

st.text("Headers in column beside widget")

a, b = st.columns(2)

with a:
    st.write("# Header header")
    st.write("## Header header")

with b:
    st.text_input("This is a label", key="2")

"---"

st.text("End of page")
