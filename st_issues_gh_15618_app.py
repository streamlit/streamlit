"""
Reproduction for GitHub Issue #15618
Title: selectbox always reverts to first item with format_func + custom classes
URL: https://github.com/streamlit/streamlit/issues/15618

Expected: Selecting an option in the selectbox keeps that selection
Actual:   selectbox always reverts to the first option
Reported version: 1.58.0
"""

from dataclasses import dataclass
from typing import NamedTuple

import streamlit as st

st.title("Issue #15618: selectbox reverts with format_func")
st.info("🔗 [View original issue](https://github.com/streamlit/streamlit/issues/15618)")

st.header("Issue Overview")
st.write("**Expected:** Selecting the second option keeps that selection.")
st.error(
    "**Actual (Bug):** selectbox always reverts to the first option when options "
    "are dataclass/plain-class instances and `format_func` does a dict lookup on them."
)

st.divider()

st.header("Bug Demonstration")
st.write(
    """
**Steps:**
1. Click the selectbox below
2. Select "two"
3. Observe it reverts back to "one"
"""
)


@dataclass(frozen=True)
class MyDataClass:
    id: int
    name: str


a = MyDataClass(1, "one")
b = MyDataClass(2, "two")
x = {a: "I", b: "II"}


def format_function(s):
    print(x[s])
    return s.name


s = st.selectbox(
    "selectbox (DataClass + format_func with dict lookup)",
    [a, b],
    format_func=format_function,
)
st.write(f"**Selected:** {s.name}")

st.divider()

st.header("Comparison: NamedTuple (works correctly)")
st.write("The same pattern with NamedTuple does NOT trigger the bug:")


class MyNamedTuple(NamedTuple):
    id: int
    name: str


c = MyNamedTuple(1, "one")
d = MyNamedTuple(2, "two")
y = {c: "I", d: "II"}


def format_function_nt(s):
    print(y[s])
    return s.name


s2 = st.selectbox(
    "selectbox (NamedTuple + format_func with dict lookup)",
    [c, d],
    format_func=format_function_nt,
)
st.write(f"**Selected:** {s2.name}")

st.divider()

st.header("Workaround")
st.write(
    "Remove the `print(x[s])` (or any expression that hashes the option object) "
    "from `format_func`. The bug only triggers when `format_func` causes a side "
    "effect that involves hashing the option objects."
)

st.divider()

st.header("Environment")
st.code(f"Streamlit version: {st.__version__}")
