import streamlit as st

st.title("Alert Title Feature Demo")

st.header("Without Title")
st.info("This is a standard info message without a title.")
st.error("This is a standard error message without a title.")
st.warning("This is a standard warning message without a title.")
st.success("This is a standard success message without a title.")

st.divider()

st.header("With Title")
st.info("Your session will expire in 5 minutes.", title="Session Notice")
st.error("Failed to connect to the database. Please check your credentials.", title="Connection Error")
st.warning("This feature will be deprecated in the next version.", title="Deprecation Warning")
st.success("Your changes have been saved successfully!", title="Success")
