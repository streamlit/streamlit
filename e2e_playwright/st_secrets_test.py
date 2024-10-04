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


def test_default_secrets_specified(app: Page):
    """Test that secrets can be accessed from the default secrets file."""

    expect(app.get_by_text("Secret: value")).to_be_attached()


def test_alternative_secrets_specified(app: Page):
    """Test that secrets can be accessed from a specific secrets file."""

    expect(app.get_by_text("Alt Secret: alt-value")).to_be_attached()
    expect(app.get_by_text("Alt Secret From File 2 visible: False")).to_be_attached()


def test_multiple_alternative_secrets_specified(app: Page):
    """Test that secrets can be accessed from multiple secrets file."""

    expect(app.get_by_text("Alt Secret (Multiple): alt-value")).to_be_attached()
    expect(
        app.get_by_text("Alt Secret From File 2 (Multiple): other-alt-value")
    ).to_be_attached()
