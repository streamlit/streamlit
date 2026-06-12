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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.elements.widgets.lens import LensMixin

    lens = LensMixin().lens

    # Basic lens - returns str or None
    assert_type(lens(), str | None)
    assert_type(lens(target_key="my-chart"), str | None)
    assert_type(lens(target_key="my-chart", label="AI Lens"), str | None)

    # Lens with key (str or int)
    assert_type(lens(key="my_lens"), str | None)
    assert_type(lens(key=123), str | None)

    # Lens with help
    assert_type(lens(help="Analyze this chart"), str | None)
    assert_type(lens(help=None), str | None)

    # Lens with disabled
    assert_type(lens(disabled=True), str | None)
    assert_type(lens(disabled=False), str | None)

    # Lens with label_visibility
    assert_type(lens(label_visibility="visible"), str | None)
    assert_type(lens(label_visibility="hidden"), str | None)
    assert_type(lens(label_visibility="collapsed"), str | None)

    # Lens with on_result callback
    def my_callback(snapshot: bytes, prompt: str) -> str:
        return f"Result: {prompt}"

    assert_type(lens(on_result=my_callback), str | None)
    assert_type(lens(on_result=None), str | None)

    # Lens with all parameters combined
    assert_type(
        lens(
            target_key="my-chart",
            label="Chart AI",
            key="full_lens",
            help="Analyze this chart",
            on_result=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
        ),
        str | None,
    )
