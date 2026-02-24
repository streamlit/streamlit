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

from e2e_playwright.conftest import build_app_url
from e2e_playwright.shared.app_utils import (
    get_markdown,
    wait_for_all_images_to_be_loaded,
)


def test_should_serve_existing_asset(app: Page, app_base_url: str):
    """Test that the static serving feature serves an existing asset."""
    response = app.request.get(
        build_app_url(app_base_url, path="/app/static/streamlit-logo.png")
    )
    expect(response).to_be_ok()
    # Assert is safe here since we don't need to wait for something here:
    assert response.status == 200


def test_static_endpoint_has_nosniff_header(app: Page, app_base_url: str):
    """Test that static endpoint sets X-Content-Type-Options: nosniff header."""
    response = app.request.get(
        build_app_url(app_base_url, path="/app/static/streamlit-logo.png")
    )
    expect(response).to_be_ok()
    nosniff_header = response.headers.get("x-content-type-options")
    assert nosniff_header == "nosniff", (
        f"Expected 'nosniff' header, got: {nosniff_header}"
    )


def test_should_return_error_on_non_existing_asset(app: Page, app_base_url: str):
    """Test that the static serving feature returns error code for non-existing asset."""
    response = app.request.get(
        build_app_url(app_base_url, path="/app/static/notexisting.jpeg")
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
