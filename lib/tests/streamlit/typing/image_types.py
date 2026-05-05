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
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.image import ImageMixin

    image = ImageMixin().image

    # =====================================================================
    # st.image return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(image("path/to/image.png"), DeltaGenerator)
    assert_type(image(Path("path/to/image.png")), DeltaGenerator)
    assert_type(image(b"binary data"), DeltaGenerator)
    assert_type(image("https://example.com/image.png"), DeltaGenerator)

    # Image with caption parameter - str or list of str
    assert_type(image("image.png", caption="My image"), DeltaGenerator)
    assert_type(image("image.png", caption=None), DeltaGenerator)
    assert_type(
        image(["img1.png", "img2.png"], caption=["Caption 1", "Caption 2"]),
        DeltaGenerator,
    )

    # Image with width parameter - "content", "stretch", or int
    assert_type(image("image.png", width="content"), DeltaGenerator)
    assert_type(image("image.png", width="stretch"), DeltaGenerator)
    assert_type(image("image.png", width=300), DeltaGenerator)

    # Image with clamp parameter
    assert_type(image("image.png", clamp=True), DeltaGenerator)
    assert_type(image("image.png", clamp=False), DeltaGenerator)

    # Image with channels parameter - "RGB" or "BGR"
    assert_type(image("image.png", channels="RGB"), DeltaGenerator)
    assert_type(image("image.png", channels="BGR"), DeltaGenerator)

    # Image with output_format parameter - "JPEG", "PNG", "GIF", or "auto"
    assert_type(image("image.png", output_format="JPEG"), DeltaGenerator)
    assert_type(image("image.png", output_format="PNG"), DeltaGenerator)
    assert_type(image("image.png", output_format="GIF"), DeltaGenerator)
    assert_type(image("image.png", output_format="auto"), DeltaGenerator)

    # Image with use_container_width parameter (deprecated but still supported)
    assert_type(image("image.png", use_container_width=True), DeltaGenerator)
    assert_type(image("image.png", use_container_width=False), DeltaGenerator)
    assert_type(image("image.png", use_container_width=None), DeltaGenerator)

    # Image with use_column_width parameter (deprecated but still supported)
    assert_type(image("image.png", use_column_width=True), DeltaGenerator)
    assert_type(image("image.png", use_column_width=False), DeltaGenerator)
    assert_type(image("image.png", use_column_width="auto"), DeltaGenerator)
    assert_type(image("image.png", use_column_width="always"), DeltaGenerator)
    assert_type(image("image.png", use_column_width="never"), DeltaGenerator)
    assert_type(image("image.png", use_column_width=None), DeltaGenerator)

    # Image with link parameter
    assert_type(image("image.png", link="https://streamlit.io"), DeltaGenerator)
    assert_type(image("image.png", link="/my_page"), DeltaGenerator)
    assert_type(image("image.png", link=None), DeltaGenerator)

    # Image with all parameters combined
    assert_type(
        image(
            "image.png",
            caption="Full example",
            width="stretch",
            clamp=False,
            channels="RGB",
            output_format="auto",
            use_container_width=None,
            link="https://streamlit.io",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "content", "stretch", or int)
    image("image.png", width="invalid")  # type: ignore[arg-type]

    # Invalid channels value (not "RGB" or "BGR")
    image("image.png", channels="RGBA")  # type: ignore[arg-type]

    # Invalid output_format value (not "JPEG", "PNG", "GIF", or "auto")
    image("image.png", output_format="WEBP")  # type: ignore[arg-type]

    # Passing link as positional argument (should be keyword-only)
    image(
        "image.png",
        None,
        "stretch",
        None,
        False,
        "RGB",
        "auto",
        None,
        "https://example.com",
    )  # type: ignore[misc]
