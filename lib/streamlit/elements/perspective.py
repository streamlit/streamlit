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

import hashlib
import json
from collections.abc import Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    cast,
)

from streamlit import dataframe_util
from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    Width,
    create_layout_config,
)
from streamlit.elements.lib.utils import Key, compute_and_register_element_id, to_key
from streamlit.proto.Perspective_pb2 import Perspective as PerspectiveProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.dataframe_util import Data
    from streamlit.delta_generator import DeltaGenerator


# TypedDict for Perspective config matches Perspective's viewer save format.
# All fields are optional since this is a partial configuration.
# Using Any for complex types to match Perspective's flexibility.
PerspectiveConfig = Mapping[str, Any]


def _compute_schema_digest(data_bytes: bytes) -> str:
    """Compute a digest of the Arrow schema from serialized Arrow bytes.

    This is used to detect schema changes that require resetting the viewer state.
    We hash only the schema portion to allow data refreshes without resetting state.
    """
    import pyarrow as pa

    # Read only the schema from the Arrow IPC stream
    reader = pa.ipc.open_stream(data_bytes)
    schema = reader.schema

    # Create a stable hash of the schema
    h = hashlib.new("md5", usedforsecurity=False)
    # Include field names and types in the hash
    for field in schema:
        h.update(field.name.encode("utf-8"))
        h.update(str(field.type).encode("utf-8"))

    return h.hexdigest()


class PerspectiveMixin:
    @gather_metrics("perspective")
    def perspective(
        self,
        data: Data,
        *,
        default_config: PerspectiveConfig | None = None,
        theme: str = "streamlit",
        key: Key | None = None,
        width: Width = "stretch",
        height: HeightWithoutContent = 500,
    ) -> DeltaGenerator:
        r"""Display an interactive Perspective data explorer.

        Perspective is a high-performance analytics library that enables interactive
        exploration of tabular data with pivots, filters, sorts, expressions, and
        chart switching. The viewer runs client-side in the browser using WebAssembly.

        Parameters
        ----------
        data : pandas.DataFrame, pyarrow.Table, or anything accepted by st.dataframe
            The tabular data to explore. Streamlit serializes it to Arrow and loads
            it into Perspective in the browser.

        default_config : dict or None
            Initial Perspective viewer configuration that seeds the viewer on first
            load or after reset. This follows Perspective's viewer configuration
            format with keys:

            - ``"plugin"``: The visualization plugin to use (e.g., ``"Datagrid"``,
              ``"Y Line"``, ``"X/Y Scatter"``).
            - ``"columns"``: Column names to display.
            - ``"group_by"``: Column names to group by (rows).
            - ``"split_by"``: Column names to split by (columns).
            - ``"sort"``: List of ``(column, direction)`` tuples where direction is
              ``"asc"`` or ``"desc"``.
            - ``"filter"``: List of ``(column, operator, value)`` tuples.
            - ``"aggregates"``: Mapping of column names to aggregation functions.
            - ``"expressions"``: Mapping of expression names to expression strings.
            - ``"settings"``: Whether to show the settings panel (``True``/``False``).

            If ``None`` (default), the viewer starts with Perspective's default
            configuration.

        theme : str
            The Perspective theme to use. ``"streamlit"`` (default) uses a
            Streamlit-generated theme that matches the app's current theme. Other
            strings are passed through as Perspective theme names.

        key : str or int or None
            An optional string or integer to use as a unique key for the element.
            If ``key`` is provided, Streamlit preserves the user's interactive
            state (filters, pivots, plugin choice) across data refreshes when
            the schema remains compatible. Changing ``key`` or the data schema
            resets the viewer to ``default_config``.

        width : "stretch" or int
            The width of the element. This can be:

            - ``"stretch"`` (default): The element uses its parent container's
              full width.
            - An ``int``: A fixed width in pixels.

        height : "stretch" or int
            The height of the element. This can be:

            - An ``int`` (default ``500``): A fixed height in pixels.
            - ``"stretch"``: The element fills the available height of its
              parent container.

        Returns
        -------
        DeltaGenerator
            The element's DeltaGenerator, which can be used for chaining.

        Examples
        --------
        **Basic usage:**

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        ...     {
        ...         "Region": ["East", "East", "West", "West"],
        ...         "Product": ["A", "B", "A", "B"],
        ...         "Sales": [100, 150, 200, 175],
        ...     }
        ... )
        >>>
        >>> st.perspective(df)

        **With initial configuration:**

        >>> st.perspective(
        ...     df,
        ...     key="sales-explorer",
        ...     height=620,
        ...     default_config={
        ...         "plugin": "Y Line",
        ...         "columns": ["Sales"],
        ...         "group_by": ["Region"],
        ...         "sort": [("Sales", "desc")],
        ...     },
        ... )

        **Start with settings panel open:**

        >>> st.perspective(
        ...     df,
        ...     default_config={
        ...         "settings": True,
        ...         "plugin": "Datagrid",
        ...     },
        ... )

        """
        layout_config = create_layout_config(width=width, height=height)

        perspective_proto = PerspectiveProto()

        # Convert data to Arrow bytes
        data_bytes = dataframe_util.convert_anything_to_arrow_bytes(data)
        perspective_proto.data.data = data_bytes

        # Compute schema digest for detecting schema changes
        schema_digest = _compute_schema_digest(data_bytes)
        perspective_proto.schema_digest = schema_digest

        # Set default_config if provided
        if default_config is not None:
            # Convert any non-JSON-serializable types in the config
            config_dict = _prepare_config_for_json(default_config)
            perspective_proto.default_config_json = json.dumps(config_dict)

        # Set theme
        perspective_proto.theme = theme

        # Compute element ID
        key = to_key(key)
        perspective_proto.id = compute_and_register_element_id(
            "perspective",
            user_key=key,
            dg=self.dg,
            # When key is provided, only schema_digest and theme affect element ID.
            # This allows viewer state to persist across data changes with same schema.
            key_as_main_identity={"schema_digest", "theme"},
            schema_digest=schema_digest,
            theme=theme,
            default_config_json=perspective_proto.default_config_json or "",
            data_hash=hashlib.md5(data_bytes, usedforsecurity=False).hexdigest(),
        )

        return self.dg._enqueue(
            "perspective", perspective_proto, layout_config=layout_config
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def _prepare_config_for_json(config: PerspectiveConfig) -> dict[str, Any]:
    """Prepare a Perspective config dict for JSON serialization.

    Converts tuples to lists since JSON doesn't support tuples.
    """
    result: dict[str, Any] = {}

    for key, value in config.items():
        if isinstance(value, (list, tuple)):
            # Convert sequences and their nested elements
            result[key] = [
                list(item) if isinstance(item, tuple) else item for item in value
            ]
        elif isinstance(value, Mapping):
            # Recursively handle nested mappings
            result[key] = _prepare_config_for_json(value)
        else:
            result[key] = value

    return result
