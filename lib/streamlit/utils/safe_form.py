
import streamlit as st
from contextlib import contextmanager

class SafeForm:
    """
    A robust wrapper around st.form to enforce UI safety and consistency.
    It prevents common errors like 'Missing Submit Button' by enforcing strict structure.
    """
    def __init__(self, key: str, clear_on_submit: bool = False, border: bool = True):
        self.key = key
        self.clear = clear_on_submit
        self.border = border
        self._submit_button_created = False
        self._container = None

    def __enter__(self):
        # We start the form
        self._container = st.form(key=self.key, clear_on_submit=self.clear, border=self.border)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Safety Check: Did the developer forget the button?
        if not self._submit_button_created and exc_type is None:
            st.error(f"Development Error: The form '{self.key}' is missing a submit button. A default one was added/required to prevent Streamlit crash.")
            self.submit_button("Safety Submit")

        # Propagate exceptions normally
        return False

    def header(self, text: str):
        """Standardized header for forms"""
        st.subheader(text)
        st.divider()

    def divider(self):
        """Safe divider that won't break form context"""
        st.divider()

    def info(self, text: str):
        st.info(text)

    def warning(self, text: str):
        st.warning(text)

    def text_input(self, label: str, **kwargs):
        return st.text_input(label, **kwargs)

    def submit_button(self, label: str = "Submit", **kwargs) -> bool:
        """
        Creates the submit button and marks the form as valid.
        """
        self._submit_button_created = True
        return st.form_submit_button(label, **kwargs)

def safe_form(key: str, clear_on_submit: bool = False):
    """
    Usage:
    with safe_form("my_form") as f:
        f.header("My Config")
        name = f.text_input("Name")
        if f.submit_button("Save"):
            st.write(f"Saved {name}")
    """
    return SafeForm(key, clear_on_submit)
