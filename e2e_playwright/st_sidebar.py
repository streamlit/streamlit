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

from datetime import date, datetime

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
data = np.random.randint(low=0, high=20, size=(20, 3))

w1 = st.sidebar.date_input("Label 1", date(1970, 1, 1))
st.write("Value 1:", w1)

w2 = st.sidebar.date_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)

x = st.sidebar.text("overwrite me")
x.text("overwritten")
y = st.sidebar.text_input("type here")

# Custom component with a portal/popover for testing sidebar behavior on mobile
# This tests the fix for GitHub issue #13647
_POPOVER_JS = """
export default function(component) {
  const { parentElement, setTriggerValue } = component

  const button = parentElement.querySelector('#popover-trigger')
  const popover = parentElement.querySelector('#popover-content')

  const handleButtonClick = () => {
    // Toggle popover visibility - this creates a portal-like overlay
    const isVisible = popover.style.display === 'block'
    popover.style.display = isVisible ? 'none' : 'block'
  }

  const handleOptionClick = (event) => {
    const option = event.target.dataset.option
    if (option) {
      setTriggerValue('selected', option)
      popover.style.display = 'none'
    }
  }

  button.addEventListener('click', handleButtonClick)
  popover.addEventListener('click', handleOptionClick)

  return () => {
    button.removeEventListener('click', handleButtonClick)
    popover.removeEventListener('click', handleOptionClick)
  }
}
"""

_POPOVER_HTML = """
<div style="position: relative;">
  <button id="popover-trigger" style="padding: 8px 16px; cursor: pointer;">
    Open Popover
  </button>
  <div id="popover-content" style="
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    min-width: 200px;
  ">
    <div style="margin-bottom: 8px; font-weight: bold;">Select an option:</div>
    <button data-option="option1" style="display: block; width: 100%; padding: 8px; margin: 4px 0; cursor: pointer;">
      Option 1
    </button>
    <button data-option="option2" style="display: block; width: 100%; padding: 8px; margin: 4px 0; cursor: pointer;">
      Option 2
    </button>
    <button data-option="option3" style="display: block; width: 100%; padding: 8px; margin: 4px 0; cursor: pointer;">
      Option 3
    </button>
  </div>
</div>
"""

_POPOVER_CMP = st.components.v2.component(
    name="sidebar_popover_test",
    js=_POPOVER_JS,
    html=_POPOVER_HTML,
)

with st.sidebar:
    st.header("hello world")
    st.markdown("hello world")
    st.bar_chart(pd.DataFrame(data, columns=["a", "b", "c"]))

    # Custom component with popover for testing portal behavior on mobile (issue #13647)
    popover_result = _POPOVER_CMP(key="sidebar_popover")
    if popover_result and popover_result.get("selected"):
        st.write(f"Selected: {popover_result['selected']}")
