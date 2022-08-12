import streamlit as st

if st.button("Rerun test"):
    st.test_run_count = -1

if hasattr(st, "test_run_count"):
    st.test_run_count += 1
else:
    st.test_run_count = 0 if st.get_option("server.headless") else -1

if st.test_run_count < 1:
    w1 = st.slider("label", 0, 100, 25, 1)
else:
    w1 = st.selectbox("label", ("m", "f"), 1)

st.write("value 1:", w1)
st.write("test_run_count:", st.test_run_count)
st.write(
    """
    If this is failing locally, it could be because you have a browser with
    Streamlit open. Close it and the test should pass.
"""
)
# TODO: Use session-specific state for test_run_count, to fix the issue above.
