
import streamlit as st
import sys
import os

# Add the lib directory to path to simulate being inside the package
sys.path.append(os.path.join(os.path.dirname(__file__), "lib"))

try:
    from streamlit.utils.safe_form import safe_form
except ImportError:
    # Fallback for direct execution
    sys.path.append(".")
    from lib.streamlit.utils.safe_form import safe_form

st.title("CineForge: SafeForm Demo")

st.markdown("### The Old Way (Fragile)")
with st.expander("See Fragile Code"):
    st.code("""
    with st.form("fragile_form"):
        st.text_input("Project Name")
        st.markdown("---") # <--- Can break context in complex nests
        submitted = st.form_submit_button("Save")
    """)

st.markdown("### The New Way (Robust)")

with safe_form("cineforge_project_settings") as f:
    f.header("Project Settings")

    col1, col2 = st.columns(2)
    with col1:
        name = f.text_input("Project Name", value="New Movie")
    with col2:
        genre = st.selectbox("Genre", ["Sci-Fi", "Action", "Drama"])

    f.info("Settings are automatically validated.")

    # Safe divider
    f.divider()

    if f.submit_button("Create Project", type="primary"):
        st.success(f"Project '{name}' ({genre}) created successfully!")

    # If we commented out the line above, SafeForm would catch it and show an error + default button.
