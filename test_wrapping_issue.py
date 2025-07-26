import streamlit as st

st.title("Pills and Segmented Control Wrapping Issue - Test")

st.markdown("""
This test demonstrates the issue described in GitHub issue #12038:
When using `width="stretch"` on `st.pills` and `st.segmented_control`, 
the pills/segments don't wrap evenly. The last row often has fewer items 
that become much wider than items in previous rows.

**Expected behavior**: Items should be distributed more evenly across rows
when wrapping occurs, ideally with similar widths.
""")

st.header("Pills with stretch width")
st.markdown("The issue is most visible when you have several options of varying lengths:")

pills_result = st.pills(
    "Select options",
    [
        "Short",
        "Medium length option",
        "A very long option that clearly demonstrates the wrapping issue",
        "Another option",
        "Final",
    ],
    width="stretch",
    key="pills_stretch"
)
st.write(f"Selected: {pills_result}")

st.header("Segmented Control with stretch width")
st.markdown("The same issue applies to segmented controls:")

segmented_result = st.segmented_control(
    "Select option",
    [
        "Short",
        "Medium length option", 
        "A very long option that clearly demonstrates the wrapping issue",
        "Another option",
        "Final",
    ],
    width="stretch",
    key="segmented_stretch"
)
st.write(f"Selected: {segmented_result}")

st.header("More extreme example with many short options")
st.markdown("With many similar-length options, the last row becomes very wide:")

pills_many = st.pills(
    "Many options",
    [f"Option {i}" for i in range(1, 16)],
    width="stretch",
    key="pills_many"
)
st.write(f"Selected: {pills_many}")

st.header("Comparison: Content width (default)")
st.markdown("For comparison, here's how it looks with default content width:")

st.pills(
    "Content width pills",
    [
        "Short",
        "Medium length option",
        "A very long option that clearly demonstrates the wrapping issue",
        "Another option",
        "Final",
    ],
    width="content",
    key="pills_content"
)

st.segmented_control(
    "Content width segmented control",
    [
        "Short",
        "Medium length option", 
        "A very long option that clearly demonstrates the wrapping issue",
        "Another option",
        "Final",
    ],
    width="content",
    key="segmented_content"
)
