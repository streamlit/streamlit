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

from typing import Literal

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

# Heights in px at the default 16px root font size.
EXPECTED_HEIGHT_PX = {
    "xxsmall": 24,
    "xsmall": 28,
    "small": 32,
    "medium": 40,
    "large": 48,
}

Role = Literal["button", "link"]

# (command, element role) for the commands that render a plain button.
COMMANDS: list[tuple[str, Role]] = [
    ("button", "button"),
    ("button_primary", "button"),
    ("button_tertiary", "button"),
    ("button_icon_only", "button"),
    ("button_icon_label", "button"),
    ("button_disabled", "button"),
    ("button_stretch", "button"),
    ("sidebar_button", "button"),
    ("download_button", "button"),
    ("link_button", "link"),
    ("form_submit_button", "button"),
]


def _control(app: Page, key: str, role: Role) -> Locator:
    return get_element_by_key(app, key).get_by_role(role)


def _height(control: Locator) -> float:
    box = control.bounding_box()
    assert box is not None
    return box["height"]


@pytest.mark.parametrize(("command", "role"), COMMANDS)
@pytest.mark.parametrize("size", list(EXPECTED_HEIGHT_PX))
def test_button_height_matches_size(app: Page, command: str, role: Role, size: str):
    """Each size renders at its documented height."""
    control = _control(app, f"{command}_{size}", role)
    expect(control).to_be_visible()
    assert _height(control) == pytest.approx(EXPECTED_HEIGHT_PX[size], abs=1)


@pytest.mark.parametrize(
    ("command", "role"),
    [
        ("button", "button"),
        ("download_button", "button"),
        ("link_button", "link"),
        ("form_submit_button", "button"),
    ],
)
def test_default_height_equals_medium(app: Page, command: str, role: Role):
    """Omitting size keeps the existing height, which is size="medium"."""
    default = _control(app, f"{command}_default", role)
    medium = _control(app, f"{command}_medium", role)
    expect(default).to_be_visible()
    assert _height(default) == pytest.approx(EXPECTED_HEIGHT_PX["medium"], abs=1)
    assert _height(default) == pytest.approx(_height(medium), abs=0.5)


@pytest.mark.parametrize("size", list(EXPECTED_HEIGHT_PX))
def test_stretch_button_fills_container_width(app: Page, size: str):
    """width="stretch" still fills the container at every size."""
    container = get_element_by_key(app, "button_stretch_sizes").bounding_box()
    button = _control(app, f"button_stretch_{size}", "button").bounding_box()
    assert container is not None
    assert button is not None
    assert button["width"] == pytest.approx(container["width"], abs=1)


@pytest.mark.parametrize("size", list(EXPECTED_HEIGHT_PX))
def test_link_button_matches_button_height(app: Page, size: str):
    """st.link_button and st.button line up at every size."""
    button = _control(app, f"button_{size}", "button")
    link = _control(app, f"link_button_{size}", "link")
    assert _height(link) == pytest.approx(_height(button), abs=0.5)


@pytest.mark.parametrize("size", list(EXPECTED_HEIGHT_PX))
def test_icon_only_button_is_at_least_as_wide_as_tall(app: Page, size: str):
    """An icon-only button never becomes narrower than its height."""
    box = _control(app, f"button_icon_only_{size}", "button").bounding_box()
    assert box is not None
    assert box["width"] >= box["height"]


def test_wrapped_label_grows_xxsmall_button(app: Page):
    """Sizes are minimum heights: a wrapped label makes the button taller."""
    button = _control(app, "button_wrapped_xxsmall", "button")
    expect(button).to_be_visible()
    assert _height(button) > EXPECTED_HEIGHT_PX["xxsmall"] + 10


@pytest.mark.parametrize(("command", "role"), COMMANDS)
def test_button_sizes_snapshot(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
    command: str,
    role: Role,
):
    """Visual check of every size for each command and button kind."""
    container = get_element_by_key(themed_app, f"{command}_sizes")
    expect(container.get_by_role(role).first).to_be_visible()
    assert_snapshot(container, name=f"st_button_size-{command}")
