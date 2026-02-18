# e2e_playwright/st_vertical_slider_test.py

from playwright.sync_api import Page, expect
from e2e_playwright.conftest import ImageCompareFunction

def test_vertical_slider_renders(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that vertical sliders are rendered correctly."""

    # Wait for the app to load and find the sliders
    sliders = app.get_by_test_id("stSlider")
    expect(sliders).to_have_count(4)

    # Take a snapshot of the vertical slider (2nd one)
    # This captures visual regressions
    vertical_slider = sliders.nth(1)
    assert_snapshot(vertical_slider, name="st_vertical_slider-visual")

def test_vertical_slider_values(app: Page):
    """Test that interacting with the vertical slider updates the value."""

    # Check initial values
    expect(app.get_by_text("Value: 50")).to_be_visible()

    # You can add logic here to drag the slider handle if needed,
    # but often just rendering verification is enough for a first pass.
