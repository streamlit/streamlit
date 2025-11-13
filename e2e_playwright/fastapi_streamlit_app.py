from __future__ import annotations

import streamlit as st


def main() -> None:
    st.set_page_config(page_title="Streamlit + FastAPI", page_icon="⚡")
    st.title("Streamlit mounted inside FastAPI")
    st.write(
        "This Streamlit app is served as part of a larger FastAPI application. "
        "You can keep using Streamlit APIs as usual."
    )

    st.header("Widget demo")
    with st.form("demo"):
        name = st.text_input("What is your name?", "FastAPI user")
        agree = st.checkbox("I like embedding Streamlit")
        submitted = st.form_submit_button("Submit")

    if submitted:
        st.success(f"Thanks, {name}! Embedded Streamlit {'does' if agree else 'does not'} spark joy.")


if __name__ == "__main__":
    main()
