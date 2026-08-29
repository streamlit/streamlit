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

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_exception


def test_error_handling_messages(app: Page) -> None:
    expect(
        app.get_by_text(
            "BidiComponent Error: JS module does not have a default export function."
        )
    ).to_be_visible()

    # Markdown-rendered messages drop literal backticks (`css` becomes <code>).
    # The provided-type clause is omitted because it is PosixPath vs WindowsPath.
    expect_exception(app, "Invalid css type. Expected one of: str, None.")
    expect_exception(app, "Pass a string path or glob.")
