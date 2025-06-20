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

from e2e_playwright.shared.app_utils import (
    get_markdown,
    wait_for_all_images_to_be_loaded,
)


def test_should_serve_existing_asset(app: Page, app_port: int):
    """Test that the static serving feature serves an existing asset."""
    response = app.request.get(
        f"http://localhost:{app_port}/app/static/streamlit-logo.png"
    )
    expect(response).to_be_ok()
    # Assert is safe here since we don't need to wait for something here:
    assert response.status == 200


def test_should_return_error_on_non_existing_asset(app: Page, app_port: int):
    """Test that the static serving feature returns error code for non-existing asset."""
    response = app.request.get(
        f"http://localhost:{app_port}/app/static/notexisting.jpeg"
    )
    expect(response).not_to_be_ok()
    # Assert is safe here since we don't need to wait for something here:
    assert response.status == 404


def test_static_served_image_embedded_in_markdown(app: Page):
    """Test that an image served via the static serving can be embedded into markdown."""
    markdown_element = get_markdown(app, "Images served via static serving:")
    image_element = markdown_element.locator("img")
    expect(image_element).to_be_visible()
    wait_for_all_images_to_be_loaded(app)
