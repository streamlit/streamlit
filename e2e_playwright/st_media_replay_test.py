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

import re

from playwright.sync_api import Page, expect


# have 1 test so we don't have to reload the video
def test_st_audio_player_and_video_player(app: Page):
    audio = app.get_by_test_id("stAudio")

    expect(audio).to_be_visible()
    expect(audio).to_have_attribute("controls", "")
    expect(audio).to_have_attribute("src", re.compile(r"^.*\.wav$", re.IGNORECASE))

    video_player = app.get_by_test_id("stVideo")
    expect(video_player).to_be_visible()
    expect(video_player).to_have_attribute(
        "src", re.compile(r"^.*\.mp4$", re.IGNORECASE)
    )
