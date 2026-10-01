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

"""Type tests for st.logo."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from typing_extensions import assert_type

if TYPE_CHECKING:
    import io
    from pathlib import Path

    import numpy.typing as npt
    from PIL import Image

    from streamlit.commands.logo import logo

    numpy_image = cast("npt.NDArray[Any]", object())
    pil_image = cast("Image.Image", object())

    # =====================================================================
    # st.logo return type tests
    # =====================================================================

    # image accepts str (path, URL, emoji, material icon), Path, bytes, BytesIO,
    # numpy arrays, and PIL images.
    assert_type(logo("path/to/logo.png"), None)
    assert_type(logo("https://example.com/logo.png"), None)
    assert_type(logo("🏠"), None)
    assert_type(logo(":material/home:"), None)
    assert_type(logo(Path("path/to/logo.png")), None)
    assert_type(logo(b"binary image"), None)
    assert_type(logo(io.BytesIO(b"binary image")), None)
    assert_type(logo(numpy_image), None)
    assert_type(logo(pil_image), None)

    # size accepts "small", "medium", or "large"
    assert_type(logo("logo.png", size="small"), None)
    assert_type(logo("logo.png", size="medium"), None)
    assert_type(logo("logo.png", size="large"), None)

    # link accepts str or None
    assert_type(logo("logo.png", link="https://streamlit.io"), None)
    assert_type(logo("logo.png", link=None), None)

    # icon_image: same types as image, plus None
    assert_type(logo("logo.png", icon_image="path/to/icon.png"), None)
    assert_type(logo("logo.png", icon_image=Path("path/to/icon.png")), None)
    assert_type(logo("logo.png", icon_image=b"binary image"), None)
    assert_type(logo("logo.png", icon_image=io.BytesIO(b"binary image")), None)
    assert_type(logo("logo.png", icon_image="🏠"), None)
    assert_type(logo("logo.png", icon_image=":material/home:"), None)
    assert_type(logo("logo.png", icon_image=numpy_image), None)
    assert_type(logo("logo.png", icon_image=pil_image), None)
    assert_type(logo("logo.png", icon_image=None), None)

    # All parameters combined
    assert_type(
        logo(
            "logo.png",
            size="large",
            link="https://streamlit.io",
            icon_image="icon.png",
        ),
        None,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # image is required
    logo()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    # image does not accept a list (unlike st.image)
    logo(["a.png", "b.png"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # image does not accept an int
    logo(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # image is not optional
    logo(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid size value (not "small", "medium", or "large")
    logo("logo.png", size="xlarge")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    logo("logo.png", size="content")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    logo("logo.png", size=24)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    logo("logo.png", size=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing keyword-only parameters as positional
    logo("logo.png", "medium")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Invalid link type
    logo("logo.png", link=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # icon_image does not accept a list
    logo("logo.png", icon_image=["a.png", "b.png"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Unknown argument (width is st.image, not st.logo)
    logo("logo.png", width="stretch")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
