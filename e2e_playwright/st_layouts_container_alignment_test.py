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

from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

CONTAINER_KEYS = [
    "container-horizontal-align-left",
    "container-horizontal-align-center",
    "container-horizontal-align-right",
    "container-horizontal-align-distribute",
    "container-horizontal-vertical-align-top",
    "container-horizontal-vertical-align-center",
    "container-horizontal-vertical-align-bottom",
    "container-vertical-vertical-align-top",
    "container-vertical-vertical-align-center",
    "container-vertical-vertical-align-bottom",
    "container-vertical-vertical-align-distribute",
    "container-vertical-horizontal-align-left",
    "container-vertical-horizontal-align-center",
    "container-vertical-horizontal-align-right",
    "container-horizontal-centered-elements",
]


def test_layouts_container_alignment(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for each top-level container in st_layouts_container_alignment.py."""
    for key in CONTAINER_KEYS:
        locator = get_element_by_key(app, key)
        assert_snapshot(locator, name=f"st_layouts_container_alignment-{key}")
