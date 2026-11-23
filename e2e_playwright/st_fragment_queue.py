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

import time

import streamlit as st

_TRIGGER_COMPONENT = st.components.v2.component(
    "fragment_queue_trigger",
    html="<button id='fire'>fire component trigger</button>",
    js="""
export default function (component) {
  const { parentElement, setTriggerValue } = component
  const button = parentElement.querySelector("#fire")
  button.onclick = () => {
    setTriggerValue("fired", true)
    setTimeout(() => {
      button.dataset.triggerSent = "true"
    }, 0)
  }
}
""",
)


@st.fragment
def my_fragment1():
    st.button("rerun fragment 1")
    status_placeholder = st.empty()
    status_placeholder.write("fragment 1 running...")
    time.sleep(3)
    status_placeholder.write("fragment 1 done!")


@st.fragment
def my_fragment2():
    if st.button("rerun fragment 2"):
        st.write("ran fragment 2")
    st.write("fragment 2 done!")


@st.fragment
def my_fragment3():
    st.button("rerun fragment 3")
    st.write("fragment 3 done!")


@st.fragment
def component_trigger_fragment() -> None:
    component_result = _TRIGGER_COMPONENT(
        key="trigger_cmp", on_fired_change=lambda: None
    )
    if component_result.fired:
        st.write("ran fragment 4 component")
    st.write("fragment 4 done!")


with st.container(border=True):
    my_fragment1()
with st.container(border=True):
    my_fragment2()
with st.container(border=True):
    my_fragment3()
with st.container(border=True):
    component_trigger_fragment()
