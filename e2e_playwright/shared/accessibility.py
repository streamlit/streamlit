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
from axe_playwright_python.sync_playwright import Axe

def check_accessibility(page: Page) -> None:
    """
    Run axe-core accessibility checks on the given page.
    Raises an assertion error if violations are found.
    """
    axe = Axe(client=page)
    # We can configure rules here. For now, we start with standard WCAG 2.1 AA.
    results = axe.run()

    if results.violations_count > 0:
        report = results.generate_report()
        raise AssertionError(f"Accessibility violations found:\n{report}")
