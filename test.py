# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from streamlit.elements.status_panel import create_status_panel

status = create_status_panel(behavior="autocollapse")

status.text("text inside panel (top)")
st.text("text outside our panel")

with status.stage("🤔 Creating files...") as s:
    st.text("Doing a thing...")
    time.sleep(0.25)
    s.set_label("✅ Created!")

status.text("text inside panel (mid)")

with status.stage("🤔 Reticulating splines...") as s:
    st.text("Doing a thing...")
    time.sleep(0.25)
    s.set_label("✅ Reticulated!")

with status.stage("🤔 Watering dromedaries...") as s:
    st.text("Doing a thing...")
    time.sleep(0.25)
    s.set_label("✅ Watered!")

status.text("text inside panel (end)")
