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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    get_element_by_key,
)


def test_stream_generator(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that `st.write_stream` can correctly streams content.
    This also tests that the return value can be rendered via `st.write`.
    """

    click_button(app, "Stream data")
    expect_markdown(app, "This is the end of the stream.")
    # There should be two markdown elements on the page:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    stream_output = get_element_by_key(app, "stream-output")
    assert_snapshot(stream_output, name="st_write_stream-generator_output")

    # Test that the rerun will output the same elements via st.write:
    rerun_app(app)

    expect_markdown(app, "This is the end of the stream.")
    # There should be two markdown elements on the page:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    # Test with the same snapshot name to make sure the output is the same:
    stream_output = get_element_by_key(app, "stream-output")
    assert_snapshot(stream_output, name="st_write_stream-generator_output")


def test_async_generator(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that `st.write_stream` correctly streams content from an async generator."""

    click_button(app, "Stream async data")
    expect_markdown(app, "This is the end of the stream.")
    # There should be two markdown elements on the page:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    stream_output = get_element_by_key(app, "stream-output")
    assert_snapshot(stream_output, name="st_write_stream-async_generator_output")

    # Test that the rerun will output the same elements via st.write:
    rerun_app(app)

    expect_markdown(app, "This is the end of the stream.")
    # There should be two markdown elements on the page:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    # Test with the same snapshot name to make sure the output is the same:
    stream_output = get_element_by_key(app, "stream-output")
    assert_snapshot(stream_output, name="st_write_stream-async_generator_output")
