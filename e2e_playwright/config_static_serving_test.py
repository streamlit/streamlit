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

from e2e_playwright.conftest import build_app_url, wait_for_app_run
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


# Tests for relative static URLs (/app/static/) in media elements
# See: https://github.com/streamlit/streamlit/issues/12104


def test_static_urls_in_media_elements(app: Page):
    """Test that media elements correctly load files via /app/static/ URLs.

    Verifies st.image, st.audio, st.video, st.chat_message(avatar), and st.logo
    all work with relative static URLs.
    """
    wait_for_app_run(app)

    # st.image with /app/static/ URL
    image = app.get_by_test_id("stImage").first.locator("img")
    expect(image).to_be_visible()
    image_src = image.get_attribute("src")
    assert image_src is not None
    assert "/app/static/streamlit-logo.png" in image_src

    # st.audio with /app/static/ URL
    audio = app.get_by_test_id("stAudio").first
    expect(audio).to_be_visible()
    audio_src = audio.get_attribute("src")
    assert audio_src is not None
    assert "/app/static/cat-purr.mp3" in audio_src

    # st.video with /app/static/ URL
    video = app.get_by_test_id("stVideo").first
    expect(video).to_be_visible()
    video_src = video.get_attribute("src")
    assert video_src is not None
    assert "/app/static/sintel-short.webm" in video_src

    # st.chat_message with avatar from /app/static/
    chat_message = app.get_by_test_id("stChatMessage").first
    expect(chat_message).to_be_visible()
    avatar_img = chat_message.locator("img").first
    expect(avatar_img).to_be_visible()
    avatar_src = avatar_img.get_attribute("src")
    assert avatar_src is not None
    assert "/app/static/streamlit-mark.png" in avatar_src

    # st.logo with /app/static/ URL
    logo = app.get_by_test_id("stHeaderLogo")
    expect(logo).to_be_visible()
    logo_src = logo.get_attribute("src")
    assert logo_src is not None
    assert "/app/static/streamlit-logo-small.png" in logo_src

    # Verify success message (all elements rendered without error)
    success = app.get_by_test_id("stAlert").first
    expect(success).to_be_visible()
    expect(success).to_contain_text("All static URL elements rendered successfully!")
