from typing import Any

import streamlit as st


class NotHashable:
    def __reduce__(self):
        raise RuntimeError("Not hashable!")


@st.memo
def foo(a: Any):
    return str(a)


st.write(foo(NotHashable()))
