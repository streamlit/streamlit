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

from pathlib import Path

import streamlit as st

STATIC_DIR = Path(__file__).parent / "static"

INLINE_HTML = """
<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0">
    <div
      id="inline-html-content"
      style="
        width: 240px;
        height: 180px;
        background: lightblue;
        box-sizing: border-box;
        padding: 16px;
      "
    >
      Inline iframe HTML
    </div>
  </body>
</html>
"""

DATA_URL = (
    "data:text/html,"
    "<!DOCTYPE html><html lang='en'><body style='margin:0'>"
    "<div id='data-url-content' style='height:1200px'>Data URL iframe</div>"
    "</body></html>"
)

WIDTH_CONTENT_HTML = """
<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0">
    <div
      id="width-content-html"
      style="
        width: 180px;
        height: 60px;
        background: plum;
        box-sizing: border-box;
        padding: 12px;
      "
    >
      Width content iframe
    </div>
  </body>
</html>
"""

st.write("st.iframe test app")

with st.container(key="inline_html_iframe"):
    st.iframe(INLINE_HTML, tab_index=3)

with st.container(key="local_html_iframe"):
    st.iframe(STATIC_DIR / "test_iframe.html")

with st.container(key="local_svg_iframe"):
    st.iframe(STATIC_DIR / "test_iframe.svg")

with st.container(key="data_url_iframe"):
    st.iframe(DATA_URL)

with st.container(key="static_url_iframe"):
    st.iframe("/app/static/test_iframe.html")

with st.container(key="content_width_iframe"):
    st.iframe(WIDTH_CONTENT_HTML, width="content")
