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

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Final

from playwright.sync_api import FrameLocator, Locator, expect

from e2e_playwright.conftest import IframedPageAttrs
from e2e_playwright.shared.app_utils import wait_for_app_run

if TYPE_CHECKING:
    from e2e_playwright.conftest import IframedPage, ImageCompareFunction

from pathlib import Path

TEST_ASSETS_DIR: Final[Path] = Path(__file__).parent / "test_assets"

# we read the iframeResizer script from the assets file and inject the content within a
# <script>{content}</script> tag to the iframe. I wasn't able to load the script from a
# url in the playwright, which is why we do it inline (I also didn't spend a ton of time
# so it might easily be possible).
IFRAME_RESIZER_SCRIPT: Final[str] = (
    TEST_ASSETS_DIR / "iframerResizer.min.js"
).read_text()


def _open_with_resize_script(
    iframed_app: IframedPage, embed: bool = False, with_min_height: bool = False
) -> FrameLocator:
    """Open the iframe with the resize script and return the frame locator."""
    src_query_params = {}
    if embed:
        src_query_params["embed"] = "true"

    frame_locator: FrameLocator = iframed_app.open_app(
        IframedPageAttrs(
            element_id="exampleframe",
            src_query_params=src_query_params,
            additional_html_head=f"<script>{IFRAME_RESIZER_SCRIPT}</script>",
        )
    )
    wait_for_app_run(frame_locator)

    resize_args: dict[str, str | int] = {"log": "true"}
    if with_min_height:
        resize_args["minHeight"] = 500

    # call the iFrameResize function with the resize arguments
    # this will make the iframe resize itself to the content.
    # The function is exposed by the injected iframerResizer script.
    frame_locator.owner.evaluate(
        f"""
        () => {{
            iFrameResize({resize_args}, '#exampleframe')
        }}
        """,
    )
    return frame_locator


def _snapshot_iframe(
    iframe: FrameLocator,
    action: Callable[[Locator], None] | None,
    assert_snapshot: ImageCompareFunction,
    snapshot_name: str,
):
    slider = iframe.get_by_test_id("stSlider")
    expect(slider).to_have_count(1)
    expect(slider).to_be_visible()
    expect(iframe.get_by_test_id("stMarkdown")).to_have_count(0)

    if action:
        action(slider)

    assert_snapshot(iframe.get_by_test_id("stApp"), name=snapshot_name)


def _snapshot_expanded_iframe(
    iframe: FrameLocator,
    assert_snapshot: ImageCompareFunction,
    snapshot_name: str,
):
    def move_slider_and_expect_markdown(slider: Locator):
        """The app renders markdown elements basedf on the slider value."""
        slider.hover()
        # click in middle of the slider (which should then have the value 10)
        slider.click()
        wait_for_app_run(iframe)
        expect(iframe.get_by_test_id("stMarkdown")).to_have_count(10)

    _snapshot_iframe(
        iframe,
        move_slider_and_expect_markdown,
        assert_snapshot,
        snapshot_name,
    )


def test_render_embedded_iframe_correctly(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe is rendered correctly when embedded
    (query param '?embed=true' added to the iframe src url)."""
    frame_locator = _open_with_resize_script(iframed_app, embed=True)
    _snapshot_iframe(
        frame_locator, None, assert_snapshot, "iframe_resizer-embedded_iframe"
    )


def test_render_embedded_iframe_expanded(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe is rendered correctly when embedded
    (query param '?embed=true' added to the iframe src url) and
    markdown elements rendered."""
    frame_locator = _open_with_resize_script(iframed_app, embed=True)
    _snapshot_expanded_iframe(
        frame_locator, assert_snapshot, "iframe_resizer-embedded_iframe_expanded"
    )


def test_render_unembedded_iframe_correctly(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe is rendered correctly when not embedded (no
    query param added to the iframe src url)."""
    frame_locator = _open_with_resize_script(iframed_app)
    _snapshot_iframe(
        frame_locator, None, assert_snapshot, "iframe_resizer-unembedded_iframe"
    )


def test_render_unembedded_iframe_expanded(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe is rendered correctly when not embedded (no
    query param added to the iframe src url) and markdown elements rendered."""
    frame_locator = _open_with_resize_script(iframed_app)
    _snapshot_expanded_iframe(
        frame_locator,
        assert_snapshot,
        "iframe_resizer-unembedded_iframe_expanded",
    )


def test_render_unembedded_iframe_with_minheight(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe has a minimum height even if there are no markdown
    elements. This means that this screenshot should have a larger height than
    the non-expanded, unembedded iframe screenshot without a min-height."""

    frame_locator = _open_with_resize_script(iframed_app, with_min_height=True)
    _snapshot_iframe(
        frame_locator,
        None,
        assert_snapshot,
        "iframe_resizer-unembedded_iframe_with_min_height",
    )


def test_render_unembedded_iframe_with_minheight_expanded(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    """Test that the iframe has a minimum height and expands correctly."""
    frame_locator = _open_with_resize_script(iframed_app, with_min_height=True)
    _snapshot_expanded_iframe(
        frame_locator,
        assert_snapshot,
        "iframe_resizer-unembedded_iframe_with_min_height_expanded",
    )
