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

import os

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_arrow_truncation():
    """Configure arrow truncation and max message size."""
    os.environ["STREAMLIT_SERVER_ENABLE_ARROW_TRUNCATION"] = "True"
    os.environ["STREAMLIT_SERVER_MAX_MESSAGE_SIZE"] = "3"
    yield
    del os.environ["STREAMLIT_SERVER_ENABLE_ARROW_TRUNCATION"]
    del os.environ["STREAMLIT_SERVER_MAX_MESSAGE_SIZE"]


@pytest.mark.usefixtures("configure_arrow_truncation")
def test_shows_limitation_message(app: Page):
    caption_elements = app.get_by_test_id("stCaptionContainer")
    expect(caption_elements).to_have_count(1)
    expect(caption_elements.nth(0)).to_have_text(
        "⚠️ Showing 12k out of 50k rows due to data size limitations. "
    )
