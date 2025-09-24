# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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


def test_error_handling_messages(app: Page) -> None:
    expect(
        app.get_by_text(
            "BidiComponent Error: JS module does not have a default export function."
        )
    ).to_be_visible()

    expect(
        app.get_by_text(
            "streamlit.errors.StreamlitAPIException: css parameter must be a string or None. "
            "Pass a string path or glob."
        )
    ).to_be_visible()
