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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.map import MapMixin

    st_map = MapMixin().map

    df = pd.DataFrame({"lat": [37.0], "lon": [-122.0]})

    # =====================================================================
    # st.map return type tests
    # =====================================================================

    # Basic map - returns DeltaGenerator
    assert_type(st_map(), DeltaGenerator)
    assert_type(st_map(df), DeltaGenerator)
    assert_type(st_map(None), DeltaGenerator)
    assert_type(st_map([[37.0, -122.0]]), DeltaGenerator)
    assert_type(st_map({"lat": [37.0], "lon": [-122.0]}), DeltaGenerator)

    # Map with latitude parameter
    assert_type(st_map(df, latitude="lat"), DeltaGenerator)
    assert_type(st_map(df, latitude=None), DeltaGenerator)

    # Map with longitude parameter
    assert_type(st_map(df, longitude="lon"), DeltaGenerator)
    assert_type(st_map(df, longitude=None), DeltaGenerator)

    # Map with color parameter
    assert_type(st_map(df, color="#ff0000"), DeltaGenerator)
    assert_type(st_map(df, color="color_col"), DeltaGenerator)
    assert_type(st_map(df, color=(255, 0, 0)), DeltaGenerator)
    assert_type(st_map(df, color=(255, 0, 0, 0.5)), DeltaGenerator)
    assert_type(st_map(df, color=(1.0, 0.0, 0.0)), DeltaGenerator)
    assert_type(st_map(df, color=None), DeltaGenerator)

    # Map with size parameter
    assert_type(st_map(df, size=100), DeltaGenerator)
    assert_type(st_map(df, size=12.5), DeltaGenerator)
    assert_type(st_map(df, size="size_col"), DeltaGenerator)
    assert_type(st_map(df, size=None), DeltaGenerator)

    # Map with zoom parameter
    assert_type(st_map(df, zoom=10), DeltaGenerator)
    assert_type(st_map(df, zoom=None), DeltaGenerator)

    # Map with width parameter
    assert_type(st_map(df, width="stretch"), DeltaGenerator)
    assert_type(st_map(df, width=500), DeltaGenerator)

    # Map with height parameter
    assert_type(st_map(df, height="stretch"), DeltaGenerator)
    assert_type(st_map(df, height=400), DeltaGenerator)

    # Map with use_container_width parameter
    assert_type(st_map(df, use_container_width=True), DeltaGenerator)
    assert_type(st_map(df, use_container_width=False), DeltaGenerator)
    assert_type(st_map(df, use_container_width=None), DeltaGenerator)

    # Map with all parameters combined
    assert_type(
        st_map(
            df,
            latitude="lat",
            longitude="lon",
            color="#ff0000",
            size=100,
            zoom=10,
            width="stretch",
            height=400,
            use_container_width=True,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid latitude / longitude values (only str | None, not int)
    st_map(df, latitude=1)  # type: ignore[arg-type]
    st_map(df, longitude=1)  # type: ignore[arg-type]

    # Invalid zoom value (only int | None, not str)
    st_map(df, zoom="10")  # type: ignore[arg-type]

    # Invalid width / height values ("content" is not a valid value here, and
    # None is not allowed)
    st_map(df, width="content")  # type: ignore[arg-type]
    st_map(df, width=None)  # type: ignore[arg-type]
    st_map(df, height="content")  # type: ignore[arg-type]
    st_map(df, height=None)  # type: ignore[arg-type]

    # All parameters except data are keyword-only.
    st_map(df, "lat")  # type: ignore[misc]
