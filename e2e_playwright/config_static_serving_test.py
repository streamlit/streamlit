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


def test_static_url_image_loads(app: Page):
    """Test that st.image with /app/static/ URL loads correctly."""
    wait_for_app_run(app)

    # Find the image element
    image = app.get_by_test_id("stImage").first.locator("img")
    expect(image).to_be_visible()

    # Verify the image src contains the static path
    src = image.get_attribute("src")
    assert src is not None
    assert "/app/static/streamlit-logo.png" in src


def test_static_url_audio_loads(app: Page):
    """Test that st.audio with /app/static/ URL loads correctly."""
    wait_for_app_run(app)

    # Find the audio element (stAudio is on the audio element itself)
    audio = app.get_by_test_id("stAudio").first
    expect(audio).to_be_visible()

    # Verify the audio src contains the static path
    src = audio.get_attribute("src")
    assert src is not None
    assert "/app/static/cat-purr.mp3" in src


def test_static_url_video_loads(app: Page):
    """Test that st.video with /app/static/ URL loads correctly."""
    wait_for_app_run(app)

    # Find the video element (stVideo is on the video element itself)
    video = app.get_by_test_id("stVideo").first
    expect(video).to_be_visible()

    # Verify the video src contains the static path
    src = video.get_attribute("src")
    assert src is not None
    assert "/app/static/sintel-short.webm" in src


def test_static_url_chat_avatar_loads(app: Page):
    """Test that st.chat_message with avatar from /app/static/ loads correctly."""
    wait_for_app_run(app)

    # Find the chat message element
    chat_message = app.get_by_test_id("stChatMessage").first
    expect(chat_message).to_be_visible()

    # The avatar image should be visible (it's rendered as img inside the chat message)
    avatar_img = chat_message.locator("img").first
    expect(avatar_img).to_be_visible()

    # Verify the avatar src contains the static path
    src = avatar_img.get_attribute("src")
    assert src is not None
    assert "/app/static/streamlit-mark.png" in src


def test_static_url_logo_loads(app: Page):
    """Test that st.logo with /app/static/ URL loads correctly."""
    wait_for_app_run(app)

    # Find the logo image in the header (stHeaderLogo is the test ID for the logo img)
    logo = app.get_by_test_id("stHeaderLogo")
    expect(logo).to_be_visible()

    # Verify the logo src contains the static path
    src = logo.get_attribute("src")
    assert src is not None
    assert "/app/static/streamlit-logo-small.png" in src


def test_all_static_url_elements_render(app: Page):
    """Test that all static URL elements render and show success message."""
    wait_for_app_run(app)

    # Verify the success message is shown (meaning all elements rendered)
    success = app.get_by_test_id("stAlert").first
    expect(success).to_be_visible()
    expect(success).to_contain_text("All static URL elements rendered successfully!")
