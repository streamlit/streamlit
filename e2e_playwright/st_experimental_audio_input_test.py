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

from playwright.sync_api import Page, expect


def test_experimental_audio_input_renders_with_deprecation_warning(app: Page):
    """Test that the experimental_audio_input component renders with a deprecation warning."""
    audio_input_warning_elements = app.get_by_test_id("stAlertContainer")
    count = 1  # Expected number of audio input elements

    # Verify that the expected number of elements is rendered
    expect(audio_input_warning_elements).to_have_count(count)

    expect(app.get_by_test_id("stAlertContainer").first).to_have_text(
        """Please replace st.experimental_audio_input with st.audio_input.
        st.experimental_audio_input will be removed after 2025-01-01."""
    )
