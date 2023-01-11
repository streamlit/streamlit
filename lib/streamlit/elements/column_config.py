# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from typing import Any, Dict, List, Optional, Union

from typing_extensions import Literal, TypedDict


class ColumnConfig(TypedDict, total=False):
    width: Optional[int]
    title: Optional[str]
    type: Optional[
        Literal[
            "text",
            "number",
            "boolean",
            "list",
            "url",
            "image",
            "chart",
            "range",
            "datetime",
            "date",
            "time",
        ]
    ]
    hidden: Optional[bool]
    editable: Optional[bool]
    alignment: Optional[Literal["left", "center", "right"]]
    metadata: Optional[Dict[str, Any]]
    column: Optional[Union[str, int]]


def parse_column_config(
    column_config: Optional[
        Union[Dict[Union[int, str], ColumnConfig], List[ColumnConfig]]
    ]
) -> Dict[Union[int, str], ColumnConfig]:
    if column_config is None:
        return {}

    if isinstance(column_config, list):
        column_config_dict: Dict[Union[int, str], ColumnConfig] = {}
        for col in column_config:
            if "column" in col and col["column"] is not None:
                column_config_dict[col["column"]] = col
        return column_config_dict
    return column_config


class ColumnConfigBuilder:
    def __init__(self):
        pass

    def __call__(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        type: Optional[
            Literal[
                "text", "number", "boolean", "list", "url", "image", "chart", "range"
            ]
        ] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type=type,
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=metadata,
            column=column,
        )

    def text(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
    ) -> ColumnConfig:
        return ColumnConfig(
            width=width,
            title=title,
            type="text",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=None,
            column=column,
        )

    def number(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
        precision: Optional[int] = None,
        format: Optional[str] = None,
        min: Optional[float] = None,
        max: Optional[float] = None,
    ) -> ColumnConfig:
        type_metadata = {}
        if precision is not None:
            type_metadata["precision"] = precision
        if format is not None:
            type_metadata["format"] = format
        if min is not None:
            type_metadata["min"] = min
        if max is not None:
            type_metadata["max"] = max

        return ColumnConfig(
            width=width,
            title=title,
            type="number",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=type_metadata if type_metadata else None,
            column=column,
        )

    def boolean(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type="boolean",
            hidden=hidden,
            editable=editable,
            alignment=None,
            metadata=None,
            column=column,
        )

    def object(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type="object",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=None,
            column=column,
        )

    def categorical(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
        options: Optional[List[str]] = None,
    ) -> ColumnConfig:
        type_metadata = {}
        if options:
            type_metadata["options"] = options

        return ColumnConfig(
            width=width,
            title=title,
            type="categorical",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=type_metadata if type_metadata else None,
            column=column,
        )

    def list(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type="list",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=None,
            column=column,
        )

    def url(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type="url",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=None,
            column=column,
        )

    def image(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
    ) -> ColumnConfig:

        return ColumnConfig(
            width=width,
            title=title,
            type="image",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=None,
            column=column,
        )

    def chart(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
        type: Optional[Literal["line", "bar"]] = None,
        min: Optional[float] = None,
        max: Optional[float] = None,
    ) -> ColumnConfig:
        type_metadata = {}
        if type is not None:
            type_metadata["type"] = type
        if min is not None:
            type_metadata["min"] = min
        if max is not None:
            type_metadata["max"] = max

        return ColumnConfig(
            width=width,
            title=title,
            type="chart",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=type_metadata if type_metadata else None,
            column=column,
        )

    def range(
        self,
        column: Optional[Union[str, int]] = None,
        *,
        width: Optional[int] = None,
        title: Optional[str] = None,
        hidden: Optional[bool] = None,
        editable: Optional[bool] = None,
        alignment: Optional[Literal["right", "left", "center"]] = None,
        min: Optional[float] = None,
        max: Optional[float] = None,
        step: Optional[float] = None,
    ) -> ColumnConfig:
        type_metadata = {}
        if step is not None:
            type_metadata["step"] = step
        if min is not None:
            type_metadata["min"] = min
        if max is not None:
            type_metadata["max"] = max

        return ColumnConfig(
            width=width,
            title=title,
            type="range",
            hidden=hidden,
            editable=editable,
            alignment=alignment,
            metadata=type_metadata if type_metadata else None,
            column=column,
        )


column_config = ColumnConfigBuilder()
