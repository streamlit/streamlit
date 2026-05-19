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

"""Source protocol and adapters for lazy dataframe loading.

This module defines the internal protocol for lazy dataframe sources and
provides adapters for in-memory pandas and Polars dataframes. The protocol
is internal and should not be exposed as a public API in Phase 1.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final, Protocol

from streamlit import dataframe_util

if TYPE_CHECKING:
    import pyarrow as pa

    from streamlit.proto.Dataframe_pb2 import SortState


@dataclass(frozen=True)
class SortConfig:
    """Configuration for server-side sorting."""

    column: str
    ascending: bool


class DataframeSourceProtocol(Protocol):
    """Protocol for lazy dataframe sources.

    This is an internal protocol. Do not expose as a public API.
    Built-in adapters and the lazy=True pandas fallback normalize to this shape.

    Attributes
    ----------
    row_count : int
        The total number of rows in the source. Always set in Phase 1.
    schema : pa.Schema
        The Arrow schema for the source columns.
    sortable : bool
        Whether server-side sorting is supported.
    """

    @property
    def row_count(self) -> int:
        """Return the total number of rows in the source."""
        ...

    @property
    def schema(self) -> pa.Schema:
        """Return the Arrow schema for the source columns."""
        ...

    @property
    def sortable(self) -> bool:
        """Return whether server-side sorting is supported."""
        ...

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortConfig | None = None,
    ) -> bytes:
        """Load a range of rows and return Arrow IPC bytes.

        Parameters
        ----------
        offset : int
            The starting row index (0-based).
        limit : int
            The maximum number of rows to return.
        sort : SortConfig | None
            Optional sort configuration for server-side sorting.

        Returns
        -------
        bytes
            Serialized Arrow IPC bytes for the requested rows.
        """
        ...


def sort_state_to_config(sort_state: SortState | None) -> SortConfig | None:
    """Convert a proto SortState to a SortConfig."""
    if sort_state is None:
        return None

    from streamlit.proto.Dataframe_pb2 import SortState as SortStateProto

    ascending = sort_state.direction != SortStateProto.SortDirection.DESCENDING
    return SortConfig(column=sort_state.column, ascending=ascending)


# Default page size for lazy loading (number of rows per chunk)
DEFAULT_PAGE_SIZE: Final[int] = 500

# Maximum rows that can be requested in a single chunk
MAX_CHUNK_LIMIT: Final[int] = 10000


class PandasDataframeSource:
    """Lazy dataframe source adapter for pandas DataFrames.

    This adapter wraps an in-memory pandas DataFrame and provides row-range
    access with optional server-side sorting. Sorting uses a stable mergesort
    to preserve relative order of equal elements.
    """

    def __init__(self, df: Any) -> None:
        """Initialize with a pandas DataFrame.

        Parameters
        ----------
        df : pd.DataFrame
            The source pandas DataFrame.
        """
        import pyarrow as pa

        self._df = df
        self._schema = pa.Schema.from_pandas(df)

    @property
    def row_count(self) -> int:
        """Return the total number of rows in the source."""
        return len(self._df)

    @property
    def schema(self) -> pa.Schema:
        """Return the Arrow schema for the source columns."""
        return self._schema

    @property
    def sortable(self) -> bool:
        """Return whether server-side sorting is supported."""
        return True

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortConfig | None = None,
    ) -> bytes:
        """Load a range of rows and return Arrow IPC bytes.

        Parameters
        ----------
        offset : int
            The starting row index (0-based).
        limit : int
            The maximum number of rows to return.
        sort : SortConfig | None
            Optional sort configuration for server-side sorting.

        Returns
        -------
        bytes
            Serialized Arrow IPC bytes for the requested rows.
        """
        df = self._df

        # Apply sorting if requested
        if sort is not None and sort.column in df.columns:
            # Use stable sort to preserve relative order of equal elements
            # Note: We don't use ignore_index=True to preserve original index labels
            df = df.sort_values(
                by=sort.column,
                ascending=sort.ascending,
                kind="stable",
            )
        elif sort is not None:
            # Check if sorting by a named index
            # We only sort by index if the column explicitly matches an index name.
            # Do NOT fall back to index sort for unknown column names.
            index_names = [name for name in df.index.names if name is not None]
            if sort.column in index_names:
                df = df.sort_index(ascending=sort.ascending)
            # If column not found in columns or named indices, ignore the sort
            # (this can happen with stale frontend requests after schema changes)

        # Slice the requested range
        end_offset = min(offset + limit, len(df))
        chunk_df = df.iloc[offset:end_offset]

        return dataframe_util.convert_pandas_df_to_arrow_bytes(chunk_df)


class PolarsDataframeSource:
    """Lazy dataframe source adapter for Polars DataFrames.

    This adapter wraps an in-memory Polars DataFrame and provides row-range
    access with optional server-side sorting.
    """

    def __init__(self, df: Any) -> None:
        """Initialize with a Polars DataFrame.

        Parameters
        ----------
        df : pl.DataFrame
            The source Polars DataFrame.
        """
        self._df = df
        # Convert Polars schema to Arrow schema using head(0) to avoid
        # materializing the entire DataFrame
        self._schema = df.head(0).to_arrow().schema

    @property
    def row_count(self) -> int:
        """Return the total number of rows in the source."""
        return int(self._df.height)

    @property
    def schema(self) -> pa.Schema:
        """Return the Arrow schema for the source columns."""
        return self._schema

    @property
    def sortable(self) -> bool:
        """Return whether server-side sorting is supported."""
        return True

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortConfig | None = None,
    ) -> bytes:
        """Load a range of rows and return Arrow IPC bytes.

        Parameters
        ----------
        offset : int
            The starting row index (0-based).
        limit : int
            The maximum number of rows to return.
        sort : SortConfig | None
            Optional sort configuration for server-side sorting.

        Returns
        -------
        bytes
            Serialized Arrow IPC bytes for the requested rows.
        """
        df = self._df

        # Apply sorting if requested
        # Note: Polars sort is unstable by default - use maintain_order=True to ensure
        # deterministic ordering of equal elements across chunk requests
        if sort is not None and sort.column in df.columns:
            df = df.sort(
                sort.column, descending=not sort.ascending, maintain_order=True
            )

        # Slice the requested range using Polars' efficient slice method
        chunk_df = df.slice(offset, limit)

        return dataframe_util.convert_arrow_table_to_arrow_bytes(chunk_df.to_arrow())


def create_dataframe_source(data: Any) -> DataframeSourceProtocol:
    """Create a lazy dataframe source from supported data types.

    Parameters
    ----------
    data : pd.DataFrame | pl.DataFrame
        The source dataframe (pandas or Polars).

    Returns
    -------
    DataframeSourceProtocol
        A lazy dataframe source adapter.

    Raises
    ------
    TypeError
        If the data type is not supported for lazy loading.
    """
    import pandas as pd

    if isinstance(data, pd.DataFrame):
        return PandasDataframeSource(data)

    if dataframe_util.is_polars_dataframe(data):
        return PolarsDataframeSource(data)

    raise TypeError(
        f"Unsupported data type for lazy loading: {type(data).__name__}. "
        "Only pandas and Polars DataFrames are supported in Phase 1."
    )
