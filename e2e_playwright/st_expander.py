# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

sidebar = st.sidebar.expander("Sidebar collapsed")
sidebar.write("I am in the sidebar")

expander = st.expander("Normal expanded", expanded=True)
expander.write("I can collapse")
expander.slider("I don't get cut off")
expander.button("I'm also not cut off (while focused)")

collapsed = st.expander("Normal collapsed")
collapsed.write("I am already collapsed")

with st.expander("With number input", expanded=True):
    # We deliberately use a list to implement this for the screenshot
    st.write("* Example list item")
    value = st.number_input("number", value=1.0, key="number")


def update_value():
    st.session_state.number = 0


update_button = st.button("Update Num Input", on_click=update_value)

st.text(st.session_state.get("number"))

if st.button("Print State Value"):
    st.text(st.session_state.get("number"))

expander_long = st.expander(
    "Long expanded: "
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum arcu nisl, tincidunt id "
    "orci id, condimentum cursus nunc. Nullam sed sodales ipsum, vel tincidunt dui. Etiam diam "
    "dolor, eleifend sit amet purus id, dictum aliquam quam.",
    expanded=True,
)
expander_long.write(
    "Integer et justo orci. In euismod posuere nulla ac maximus. Mauris tristique hendrerit "
    "placerat. Integer eu imperdiet ipsum. Praesent maximus pharetra est, ut ultrices ante "
    "molestie id. Nulla sollicitudin arcu orci, eget lobortis lacus ultricies eu. Ut suscipit est "
    "eget tellus laoreet faucibus. Nullam nec blandit felis. Nulla ullamcorper, justo eget "
    "consequat ultricies, nisi dolor lacinia mauris, eu lacinia ante nisi sit amet tortor."
)

collapsed_long = st.expander(
    "Long collapsed: "
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum arcu nisl, tincidunt id "
    "orci id, condimentum cursus nunc. Nullam sed sodales ipsum, vel tincidunt dui. Etiam diam "
    "dolor, eleifend sit amet purus id, dictum aliquam quam."
)
collapsed_long.write("I am already collapsed")

expander_material_icon = st.expander("Material icon", icon=":material/bolt:").write(
    "This is an expander with a material icon."
)

expander_emoji_icon = st.expander("Emoji icon", icon="🎈").write(
    "This is an expander with an emoji icon."
)

st.expander(
    "Markdown -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_"
).write("Content")


level1 = st.expander("Nested", expanded=True)
level1.write("First level expander")

level2 = level1.expander("Inner expander")
level2.write("Second level expander")

with st.expander("Fixed width", width=200):
    st.write("Hello")

with st.expander("Stretch width", width="stretch"):
    st.write("Hello")

st.expander("Empty", expanded=True)

# Compact expanders
st.expander("Compact collapsed", type="compact").write("Compact mode content")

with st.expander("Compact expanded", expanded=True, type="compact"):
    st.write("Compact content with no border")
    st.code("print('hello')")

st.expander("Compact with icon", type="compact", icon=":material/psychology:").write(
    "AI reasoning content"
)


# To test for: https://github.com/streamlit/streamlit/issues/12149
code_block = """

```python
print('I am hopelessly, breathlessly, madly in love with Streamlit—the smooth-talking, curve-hugging seductress of \
the coding world that takes raw, unfiltered Python and slips it into something sleek, interactive, and irresistibly \
gorgeous, making every app feel like a love letter to data, every click a flirtation, and every build a slow, \
satisfying dance of creation that leaves you wanting more.')
```

"""
st.expander("With code block:\n" + code_block)

# ============================================================================
# Dynamic Expander Tests (on_change="rerun")
# ============================================================================

if "lazy_exec_count" not in st.session_state:
    st.session_state.lazy_exec_count = 0

exp_lazy = st.expander("Dynamic lazy execution", on_change="rerun")

if exp_lazy.open:
    with exp_lazy:
        st.session_state.lazy_exec_count += 1
        st.write(f"Lazy content executed {st.session_state.lazy_exec_count} times")
        st.write("This only runs when expander is open")

st.write(f"Lazy execution count: {st.session_state.lazy_exec_count}")


def open_dynamic_exp():
    st.session_state.prog_exp = True


def close_dynamic_exp():
    st.session_state.prog_exp = False


col1, col2 = st.columns(2)
with col1:
    st.button("Open Dynamic", on_click=open_dynamic_exp, key="open_dyn")
with col2:
    st.button("Close Dynamic", on_click=close_dynamic_exp, key="close_dyn")

exp_prog = st.expander("Programmatic dynamic", key="prog_exp", on_change="rerun")

if exp_prog.open:
    with exp_prog:
        st.write("Programmatically controlled")


# Track execution for nested lazy loading
if "nested_outer_exec" not in st.session_state:
    st.session_state.nested_outer_exec = 0
if "nested_inner_exec" not in st.session_state:
    st.session_state.nested_inner_exec = 0


def open_outer():
    st.session_state.outer_dyn = True


def close_outer():
    st.session_state.outer_dyn = False


def open_inner():
    st.session_state.inner_dyn = True


def close_inner():
    st.session_state.inner_dyn = False


# Buttons for programmatic control of nested expanders
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.button("Open Outer", on_click=open_outer, key="open_outer_btn")
with col2:
    st.button("Close Outer", on_click=close_outer, key="close_outer_btn")
with col3:
    st.button("Open Inner", on_click=open_inner, key="open_inner_btn")
with col4:
    st.button("Close Inner", on_click=close_inner, key="close_inner_btn")

exp_outer_dyn = st.expander("Outer dynamic", key="outer_dyn", on_change="rerun")
if exp_outer_dyn.open:
    with exp_outer_dyn:
        st.session_state.nested_outer_exec += 1
        st.write(f"Outer executed {st.session_state.nested_outer_exec} times")

        exp_inner_dyn = st.expander(
            "Inner dynamic nested", key="inner_dyn", on_change="rerun"
        )

        if exp_inner_dyn.open:
            with exp_inner_dyn:
                st.session_state.nested_inner_exec += 1
                st.write(f"Inner executed {st.session_state.nested_inner_exec} times")

st.write(
    f"Nested execution - Outer: {st.session_state.nested_outer_exec}, Inner: {st.session_state.nested_inner_exec}"
)

# Ignore mode (default) — should NOT trigger reruns on toggle
# ============================================================================

if "exp_ignore_rerun_count" not in st.session_state:
    st.session_state.exp_ignore_rerun_count = 0

st.session_state.exp_ignore_rerun_count += 1

with st.expander("Ignore-mode expander"):
    st.write("This expander uses the default on_change='ignore'")

st.write(f"Expander ignore rerun count: {st.session_state.exp_ignore_rerun_count}")

# Callback support
# ============================================================================

if "cb_toggle_count" not in st.session_state:
    st.session_state.cb_toggle_count = 0
if "cb_last_state" not in st.session_state:
    st.session_state.cb_last_state = None


def expander_callback() -> None:
    st.session_state.cb_toggle_count += 1
    st.session_state.cb_last_state = st.session_state.cb_expander


with st.expander("Callback expander", key="cb_expander", on_change=expander_callback):
    st.write("Callback expander content")

st.write(f"Callback count: {st.session_state.cb_toggle_count}")
st.write(f"Callback last state: {st.session_state.cb_last_state}")


# Callback with args/kwargs
# ============================================================================

if "cb_args_result" not in st.session_state:
    st.session_state.cb_args_result = ""


def expander_callback_with_args(prefix: str, suffix: str = "") -> None:
    st.session_state.cb_args_result = f"{prefix}-toggled-{suffix}"


with st.expander(
    "Callback args expander",
    key="cb_args_expander",
    on_change=expander_callback_with_args,
    args=("hello",),
    kwargs={"suffix": "world"},
):
    st.write("Callback args expander content")

st.write(f"Callback args result: {st.session_state.cb_args_result}")

# ============================================================================
# State Persistence Test — keyed expander should persist open/close across remount
# ============================================================================

persist_show = st.toggle(
    "Show extra text above expander", key="persist_expander_toggle"
)
if persist_show:
    st.write("Extra text inserted above expander")

with st.expander("Persist expander", expanded=False, key="persist_expander"):
    st.write("Persist expander content")

# ============================================================================
# Multiple Stateful Expanders — programmatic close regression test
# https://github.com/streamlit/streamlit/issues/14943
# ============================================================================


def close_multi_exp_a() -> None:
    st.session_state.multi_exp_a = False


def close_multi_exp_b() -> None:
    st.session_state.multi_exp_b = False


exp_a = st.expander("Multi exp A", key="multi_exp_a", on_change="rerun")
with exp_a:
    st.write("Expander A content")
    st.button("Close A", on_click=close_multi_exp_a, key="close_multi_exp_a_btn")

exp_b = st.expander("Multi exp B", key="multi_exp_b", on_change="rerun")
with exp_b:
    st.write("Expander B content")
    st.button("Close B", on_click=close_multi_exp_b, key="close_multi_exp_b_btn")
