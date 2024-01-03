# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page, expect


def test_query_params_exception_msg(app: Page):
    assert app.get_by_test_id("stException") is not None
    expect(
        app.get_by_text(
            "Using st.query_params together with either st.experimental_get_query_params or st.experimental_set_query_params is not supported. Please convert your app to only use st.query_params"
        )
    ).to_be_visible()
