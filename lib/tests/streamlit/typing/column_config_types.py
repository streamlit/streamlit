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

"""Type tests for st.column_config helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type, cast

if TYPE_CHECKING:
    import datetime

    from streamlit.elements.lib.column_config_utils import ColumnConfigMappingInput
    from streamlit.elements.lib.column_types import (
        AreaChartColumn,
        AudioColumn,
        BarChartColumn,
        ButtonColumn,
        ButtonColumnResult,
        CheckboxColumn,
        Column,
        ColumnConfig,
        ColumnWidth,
        DateColumn,
        DatetimeColumn,
        ImageColumn,
        JsonColumn,
        LineChartColumn,
        LinkColumn,
        ListColumn,
        MarkdownColumn,
        MultiselectColumn,
        NumberColumn,
        ProgressColumn,
        SelectboxColumn,
        TextColumn,
        TimeColumn,
        VideoColumn,
    )
    from streamlit.typing import ButtonColumnClickState

    # ButtonColumn click state supports attribute and bracket access.
    click_state = cast("ButtonColumnClickState", object())
    assert_type(click_state.row, int)
    assert_type(click_state["row"], int)
    assert_type(click_state.label, str)
    assert_type(click_state["label"], str)

    def _on_click() -> None:
        pass

    def _on_click_with_args(x: int, y: str) -> None:
        pass

    def _format_selectbox(option: str | int | float | bool) -> str:
        return str(option)

    def _format_label(option: str) -> str:
        return option

    pixel_width: int = 120
    flexible_width: ColumnWidth | None = "large"
    pinned_flag: bool | None = False
    css_color: str | None = "#483d8b"
    y_bound: int | float | None = 0

    # =====================================================================
    # Column
    # =====================================================================

    assert_type(Column(), ColumnConfig)
    assert_type(Column("Name"), ColumnConfig)
    assert_type(Column(label=None), ColumnConfig)
    assert_type(Column(""), ColumnConfig)
    assert_type(Column(width="small"), ColumnConfig)
    assert_type(Column(width="medium"), ColumnConfig)
    assert_type(Column(width="large"), ColumnConfig)
    assert_type(Column(width=100), ColumnConfig)
    assert_type(Column(width=None), ColumnConfig)
    assert_type(Column(width=pixel_width), ColumnConfig)
    assert_type(Column(width=flexible_width), ColumnConfig)
    assert_type(Column(help="Shown on hover"), ColumnConfig)
    assert_type(Column(help=None), ColumnConfig)
    assert_type(Column(disabled=True), ColumnConfig)
    assert_type(Column(disabled=False), ColumnConfig)
    assert_type(Column(disabled=None), ColumnConfig)
    assert_type(Column(required=True), ColumnConfig)
    assert_type(Column(required=False), ColumnConfig)
    assert_type(Column(required=None), ColumnConfig)
    assert_type(Column(pinned=True), ColumnConfig)
    assert_type(Column(pinned=False), ColumnConfig)
    assert_type(Column(pinned=None), ColumnConfig)
    assert_type(Column(pinned=pinned_flag), ColumnConfig)
    assert_type(Column(alignment="left"), ColumnConfig)
    assert_type(Column(alignment="center"), ColumnConfig)
    assert_type(Column(alignment="right"), ColumnConfig)
    assert_type(Column(alignment=None), ColumnConfig)
    assert_type(
        Column(
            "Name",
            width="medium",
            help="Shown on hover",
            disabled=False,
            required=True,
            pinned=False,
            alignment="left",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # NumberColumn
    # =====================================================================

    assert_type(NumberColumn(), ColumnConfig)
    assert_type(NumberColumn("Amount"), ColumnConfig)
    assert_type(NumberColumn(label=None), ColumnConfig)
    assert_type(NumberColumn(width="small"), ColumnConfig)
    assert_type(NumberColumn(width="large"), ColumnConfig)
    assert_type(NumberColumn(width=80), ColumnConfig)
    assert_type(NumberColumn(width=None), ColumnConfig)
    assert_type(NumberColumn(help=None), ColumnConfig)
    assert_type(NumberColumn(disabled=None), ColumnConfig)
    assert_type(NumberColumn(required=None), ColumnConfig)
    assert_type(NumberColumn(pinned=None), ColumnConfig)
    assert_type(NumberColumn(alignment=None), ColumnConfig)
    assert_type(NumberColumn(default=None), ColumnConfig)
    assert_type(NumberColumn(default=0), ColumnConfig)
    assert_type(NumberColumn(default=1.5), ColumnConfig)
    assert_type(NumberColumn(format=None), ColumnConfig)
    assert_type(NumberColumn(format="plain"), ColumnConfig)
    assert_type(NumberColumn(format="localized"), ColumnConfig)
    assert_type(NumberColumn(format="dollar"), ColumnConfig)
    assert_type(NumberColumn(format="euro"), ColumnConfig)
    assert_type(NumberColumn(format="yen"), ColumnConfig)
    assert_type(NumberColumn(format="percent"), ColumnConfig)
    assert_type(NumberColumn(format="compact"), ColumnConfig)
    assert_type(NumberColumn(format="scientific"), ColumnConfig)
    assert_type(NumberColumn(format="engineering"), ColumnConfig)
    assert_type(NumberColumn(format="accounting"), ColumnConfig)
    assert_type(NumberColumn(format="bytes"), ColumnConfig)
    assert_type(NumberColumn(format="%.2f"), ColumnConfig)
    assert_type(NumberColumn(min_value=None), ColumnConfig)
    assert_type(NumberColumn(min_value=0), ColumnConfig)
    assert_type(NumberColumn(min_value=0.5), ColumnConfig)
    assert_type(NumberColumn(max_value=None), ColumnConfig)
    assert_type(NumberColumn(max_value=10), ColumnConfig)
    assert_type(NumberColumn(max_value=10.5), ColumnConfig)
    assert_type(NumberColumn(step=None), ColumnConfig)
    assert_type(NumberColumn(step=1), ColumnConfig)
    assert_type(NumberColumn(step=0.1), ColumnConfig)
    assert_type(NumberColumn(min_value=y_bound, max_value=y_bound), ColumnConfig)
    assert_type(
        NumberColumn(
            "Amount",
            width="medium",
            help="Revenue",
            disabled=False,
            required=True,
            pinned=True,
            alignment="right",
            default=0,
            format="dollar",
            min_value=0,
            max_value=100.0,
            step=0.5,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # TextColumn
    # =====================================================================

    assert_type(TextColumn(), ColumnConfig)
    assert_type(TextColumn("Note"), ColumnConfig)
    assert_type(TextColumn(label=None), ColumnConfig)
    assert_type(TextColumn(width="small"), ColumnConfig)
    assert_type(TextColumn(width="large"), ColumnConfig)
    assert_type(TextColumn(width=160), ColumnConfig)
    assert_type(TextColumn(width=None), ColumnConfig)
    assert_type(TextColumn(help=None), ColumnConfig)
    assert_type(TextColumn(disabled=None), ColumnConfig)
    assert_type(TextColumn(required=None), ColumnConfig)
    assert_type(TextColumn(pinned=None), ColumnConfig)
    assert_type(TextColumn(alignment="center"), ColumnConfig)
    assert_type(TextColumn(alignment=None), ColumnConfig)
    assert_type(TextColumn(default=None), ColumnConfig)
    assert_type(TextColumn(default="n/a"), ColumnConfig)
    assert_type(TextColumn(max_chars=None), ColumnConfig)
    assert_type(TextColumn(max_chars=32), ColumnConfig)
    assert_type(TextColumn(validate=None), ColumnConfig)
    assert_type(TextColumn(validate=r"^[a-z]+$"), ColumnConfig)
    assert_type(
        TextColumn(
            "Note",
            width="medium",
            help="Free text",
            disabled=False,
            required=False,
            pinned=False,
            alignment="left",
            default="",
            max_chars=120,
            validate=r".+",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # LinkColumn
    # =====================================================================

    assert_type(LinkColumn(), ColumnConfig)
    assert_type(LinkColumn("Site"), ColumnConfig)
    assert_type(LinkColumn(label=None), ColumnConfig)
    assert_type(LinkColumn(width="small"), ColumnConfig)
    assert_type(LinkColumn(width="large"), ColumnConfig)
    assert_type(LinkColumn(width=200), ColumnConfig)
    assert_type(LinkColumn(width=None), ColumnConfig)
    assert_type(LinkColumn(help=None), ColumnConfig)
    assert_type(LinkColumn(disabled=None), ColumnConfig)
    assert_type(LinkColumn(required=None), ColumnConfig)
    assert_type(LinkColumn(pinned=None), ColumnConfig)
    assert_type(LinkColumn(alignment="left"), ColumnConfig)
    assert_type(LinkColumn(alignment=None), ColumnConfig)
    assert_type(LinkColumn(default=None), ColumnConfig)
    assert_type(LinkColumn(default="https://example.com"), ColumnConfig)
    assert_type(LinkColumn(max_chars=None), ColumnConfig)
    assert_type(LinkColumn(max_chars=64), ColumnConfig)
    assert_type(LinkColumn(validate=None), ColumnConfig)
    assert_type(LinkColumn(validate=r"^https://"), ColumnConfig)
    assert_type(LinkColumn(display_text=None), ColumnConfig)
    assert_type(LinkColumn(display_text="Open"), ColumnConfig)
    assert_type(
        LinkColumn(
            "Site",
            width="medium",
            help="External link",
            disabled=True,
            required=False,
            pinned=False,
            alignment="left",
            default=None,
            max_chars=80,
            validate=r"^https://",
            display_text="Open",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # CheckboxColumn
    # =====================================================================

    assert_type(CheckboxColumn(), ColumnConfig)
    assert_type(CheckboxColumn("Done"), ColumnConfig)
    assert_type(CheckboxColumn(label=None), ColumnConfig)
    assert_type(CheckboxColumn(width="small"), ColumnConfig)
    assert_type(CheckboxColumn(width="large"), ColumnConfig)
    assert_type(CheckboxColumn(width=75), ColumnConfig)
    assert_type(CheckboxColumn(width=None), ColumnConfig)
    assert_type(CheckboxColumn(help=None), ColumnConfig)
    assert_type(CheckboxColumn(disabled=None), ColumnConfig)
    assert_type(CheckboxColumn(required=None), ColumnConfig)
    assert_type(CheckboxColumn(pinned=None), ColumnConfig)
    assert_type(CheckboxColumn(alignment="center"), ColumnConfig)
    assert_type(CheckboxColumn(alignment=None), ColumnConfig)
    assert_type(CheckboxColumn(default=None), ColumnConfig)
    assert_type(CheckboxColumn(default=True), ColumnConfig)
    assert_type(CheckboxColumn(default=False), ColumnConfig)
    assert_type(
        CheckboxColumn(
            "Done",
            width="small",
            help="Completed",
            disabled=False,
            required=True,
            pinned=True,
            alignment="center",
            default=False,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # SelectboxColumn
    # =====================================================================

    assert_type(SelectboxColumn(), ColumnConfig)
    assert_type(SelectboxColumn("Category"), ColumnConfig)
    assert_type(SelectboxColumn(label=None), ColumnConfig)
    assert_type(SelectboxColumn(width="small"), ColumnConfig)
    assert_type(SelectboxColumn(width="large"), ColumnConfig)
    assert_type(SelectboxColumn(width=180), ColumnConfig)
    assert_type(SelectboxColumn(width=None), ColumnConfig)
    assert_type(SelectboxColumn(help=None), ColumnConfig)
    assert_type(SelectboxColumn(disabled=None), ColumnConfig)
    assert_type(SelectboxColumn(required=None), ColumnConfig)
    assert_type(SelectboxColumn(pinned=None), ColumnConfig)
    assert_type(SelectboxColumn(default=None), ColumnConfig)
    assert_type(SelectboxColumn(default="a"), ColumnConfig)
    assert_type(SelectboxColumn(default=1), ColumnConfig)
    assert_type(SelectboxColumn(default=1.5), ColumnConfig)
    assert_type(SelectboxColumn(default=True), ColumnConfig)
    assert_type(SelectboxColumn(options=None), ColumnConfig)
    assert_type(SelectboxColumn(options=["a", "b"]), ColumnConfig)
    assert_type(SelectboxColumn(options=("a", "b")), ColumnConfig)
    assert_type(SelectboxColumn(options=[1, 2]), ColumnConfig)
    assert_type(SelectboxColumn(options=[1.5, 2.5]), ColumnConfig)
    assert_type(SelectboxColumn(options=[True, False]), ColumnConfig)
    assert_type(SelectboxColumn(options=["a", 1, 1.5, False]), ColumnConfig)
    assert_type(SelectboxColumn(format_func=None), ColumnConfig)
    assert_type(SelectboxColumn(format_func=_format_selectbox), ColumnConfig)
    assert_type(
        SelectboxColumn(
            "Category",
            width="medium",
            help="Pick one",
            disabled=False,
            required=True,
            pinned=False,
            default="a",
            options=["a", "b"],
            format_func=_format_selectbox,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # BarChartColumn, LineChartColumn, AreaChartColumn
    # =====================================================================

    assert_type(BarChartColumn(), ColumnConfig)
    assert_type(BarChartColumn("Sales"), ColumnConfig)
    assert_type(BarChartColumn(label=None), ColumnConfig)
    assert_type(BarChartColumn(width="small"), ColumnConfig)
    assert_type(BarChartColumn(width="medium"), ColumnConfig)
    assert_type(BarChartColumn(width="large"), ColumnConfig)
    assert_type(BarChartColumn(width=100), ColumnConfig)
    assert_type(BarChartColumn(width=None), ColumnConfig)
    assert_type(BarChartColumn(help=None), ColumnConfig)
    assert_type(BarChartColumn(pinned=None), ColumnConfig)
    assert_type(BarChartColumn(pinned=pinned_flag), ColumnConfig)
    assert_type(BarChartColumn(y_min=None), ColumnConfig)
    assert_type(BarChartColumn(y_min=0), ColumnConfig)
    assert_type(BarChartColumn(y_min=0.5), ColumnConfig)
    assert_type(BarChartColumn(y_max=None), ColumnConfig)
    assert_type(BarChartColumn(y_max=100), ColumnConfig)
    assert_type(BarChartColumn(y_max=100.5), ColumnConfig)
    assert_type(BarChartColumn(y_min=y_bound, y_max=y_bound), ColumnConfig)
    assert_type(BarChartColumn(color=None), ColumnConfig)
    assert_type(BarChartColumn(color="auto"), ColumnConfig)
    assert_type(BarChartColumn(color="auto-inverse"), ColumnConfig)
    assert_type(BarChartColumn(color="red"), ColumnConfig)
    assert_type(BarChartColumn(color="primary"), ColumnConfig)
    assert_type(BarChartColumn(color="#483d8b"), ColumnConfig)
    assert_type(BarChartColumn(color=css_color), ColumnConfig)
    assert_type(
        BarChartColumn(
            "Sales",
            width="medium",
            help="Last 6 months",
            pinned=False,
            y_min=0,
            y_max=100.0,
            color="auto",
        ),
        ColumnConfig,
    )

    assert_type(LineChartColumn(), ColumnConfig)
    assert_type(LineChartColumn("Sales"), ColumnConfig)
    assert_type(LineChartColumn(label=None), ColumnConfig)
    assert_type(LineChartColumn(width="small"), ColumnConfig)
    assert_type(LineChartColumn(width="large"), ColumnConfig)
    assert_type(LineChartColumn(width=140), ColumnConfig)
    assert_type(LineChartColumn(width=None), ColumnConfig)
    assert_type(LineChartColumn(help=None), ColumnConfig)
    assert_type(LineChartColumn(pinned=None), ColumnConfig)
    assert_type(LineChartColumn(y_min=None), ColumnConfig)
    assert_type(LineChartColumn(y_min=0), ColumnConfig)
    assert_type(LineChartColumn(y_max=None), ColumnConfig)
    assert_type(LineChartColumn(y_max=1.5), ColumnConfig)
    assert_type(LineChartColumn(color=None), ColumnConfig)
    assert_type(LineChartColumn(color="auto"), ColumnConfig)
    assert_type(LineChartColumn(color="auto-inverse"), ColumnConfig)
    assert_type(LineChartColumn(color="grey"), ColumnConfig)
    assert_type(LineChartColumn(color="rgb(72, 61, 139)"), ColumnConfig)
    assert_type(LineChartColumn(color=css_color), ColumnConfig)
    assert_type(
        LineChartColumn(
            "Sales",
            width="large",
            help="Trend",
            pinned=True,
            y_min=0.0,
            y_max=100,
            color="#483d8b",
        ),
        ColumnConfig,
    )

    assert_type(AreaChartColumn(), ColumnConfig)
    assert_type(AreaChartColumn("Sales"), ColumnConfig)
    assert_type(AreaChartColumn(label=None), ColumnConfig)
    assert_type(AreaChartColumn(width="small"), ColumnConfig)
    assert_type(AreaChartColumn(width="medium"), ColumnConfig)
    assert_type(AreaChartColumn(width="large"), ColumnConfig)
    assert_type(AreaChartColumn(width=pixel_width), ColumnConfig)
    assert_type(AreaChartColumn(width=None), ColumnConfig)
    assert_type(AreaChartColumn(width=flexible_width), ColumnConfig)
    assert_type(AreaChartColumn(help=None), ColumnConfig)
    assert_type(AreaChartColumn(help="Last 6 months"), ColumnConfig)
    assert_type(AreaChartColumn(pinned=True), ColumnConfig)
    assert_type(AreaChartColumn(pinned=False), ColumnConfig)
    assert_type(AreaChartColumn(pinned=None), ColumnConfig)
    assert_type(AreaChartColumn(pinned=pinned_flag), ColumnConfig)
    assert_type(AreaChartColumn(y_min=None), ColumnConfig)
    assert_type(AreaChartColumn(y_min=0), ColumnConfig)
    assert_type(AreaChartColumn(y_min=0.5), ColumnConfig)
    assert_type(AreaChartColumn(y_max=None), ColumnConfig)
    assert_type(AreaChartColumn(y_max=100), ColumnConfig)
    assert_type(AreaChartColumn(y_max=100.5), ColumnConfig)
    assert_type(AreaChartColumn(y_min=y_bound, y_max=y_bound), ColumnConfig)
    assert_type(AreaChartColumn(color=None), ColumnConfig)
    assert_type(AreaChartColumn(color="auto"), ColumnConfig)
    assert_type(AreaChartColumn(color="auto-inverse"), ColumnConfig)
    assert_type(AreaChartColumn(color="red"), ColumnConfig)
    assert_type(AreaChartColumn(color="grey"), ColumnConfig)
    assert_type(AreaChartColumn(color="primary"), ColumnConfig)
    assert_type(AreaChartColumn(color="#483d8b"), ColumnConfig)
    assert_type(AreaChartColumn(color="rgb(72, 61, 139)"), ColumnConfig)
    assert_type(AreaChartColumn(color=css_color), ColumnConfig)
    assert_type(
        AreaChartColumn(
            "Sales (last 6 months)",
            width="medium",
            help="The sales volume in the last 6 months",
            pinned=False,
            y_min=0,
            y_max=100.0,
            color="auto",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # ImageColumn, AudioColumn, VideoColumn
    # =====================================================================

    assert_type(ImageColumn(), ColumnConfig)
    assert_type(ImageColumn("Preview"), ColumnConfig)
    assert_type(ImageColumn(label=None), ColumnConfig)
    assert_type(ImageColumn(width="small"), ColumnConfig)
    assert_type(ImageColumn(width="medium"), ColumnConfig)
    assert_type(ImageColumn(width="large"), ColumnConfig)
    assert_type(ImageColumn(width=96), ColumnConfig)
    assert_type(ImageColumn(width=None), ColumnConfig)
    assert_type(ImageColumn(help=None), ColumnConfig)
    assert_type(ImageColumn(pinned=None), ColumnConfig)
    assert_type(ImageColumn(alignment="left"), ColumnConfig)
    assert_type(ImageColumn(alignment="center"), ColumnConfig)
    assert_type(ImageColumn(alignment="right"), ColumnConfig)
    assert_type(ImageColumn(alignment=None), ColumnConfig)
    assert_type(
        ImageColumn(
            "Preview",
            width="medium",
            help="Thumbnail",
            pinned=False,
            alignment="center",
        ),
        ColumnConfig,
    )

    assert_type(AudioColumn(), ColumnConfig)
    assert_type(AudioColumn("Clip"), ColumnConfig)
    assert_type(AudioColumn(label=None), ColumnConfig)
    assert_type(AudioColumn(width="small"), ColumnConfig)
    assert_type(AudioColumn(width="large"), ColumnConfig)
    assert_type(AudioColumn(width=120), ColumnConfig)
    assert_type(AudioColumn(width=None), ColumnConfig)
    assert_type(AudioColumn(help=None), ColumnConfig)
    assert_type(AudioColumn(pinned=True), ColumnConfig)
    assert_type(AudioColumn(pinned=None), ColumnConfig)
    assert_type(AudioColumn(alignment="center"), ColumnConfig)
    assert_type(AudioColumn(alignment=None), ColumnConfig)
    assert_type(
        AudioColumn(
            "Clip",
            width="small",
            help="Playback",
            pinned=False,
            alignment="left",
        ),
        ColumnConfig,
    )

    assert_type(VideoColumn(), ColumnConfig)
    assert_type(VideoColumn("Clip"), ColumnConfig)
    assert_type(VideoColumn(label=None), ColumnConfig)
    assert_type(VideoColumn(width="medium"), ColumnConfig)
    assert_type(VideoColumn(width="large"), ColumnConfig)
    assert_type(VideoColumn(width=240), ColumnConfig)
    assert_type(VideoColumn(width=None), ColumnConfig)
    assert_type(VideoColumn(help="Playback"), ColumnConfig)
    assert_type(VideoColumn(help=None), ColumnConfig)
    assert_type(VideoColumn(pinned=None), ColumnConfig)
    assert_type(VideoColumn(alignment="right"), ColumnConfig)
    assert_type(VideoColumn(alignment=None), ColumnConfig)
    assert_type(
        VideoColumn(
            "Clip",
            width="large",
            help="Playback",
            pinned=True,
            alignment="center",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # ListColumn
    # =====================================================================

    assert_type(ListColumn(), ColumnConfig)
    assert_type(ListColumn("Tags"), ColumnConfig)
    assert_type(ListColumn(label=None), ColumnConfig)
    assert_type(ListColumn(width="small"), ColumnConfig)
    assert_type(ListColumn(width="large"), ColumnConfig)
    assert_type(ListColumn(width=200), ColumnConfig)
    assert_type(ListColumn(width=None), ColumnConfig)
    assert_type(ListColumn(help=None), ColumnConfig)
    assert_type(ListColumn(pinned=None), ColumnConfig)
    assert_type(ListColumn(disabled=True), ColumnConfig)
    assert_type(ListColumn(disabled=None), ColumnConfig)
    assert_type(ListColumn(required=False), ColumnConfig)
    assert_type(ListColumn(required=None), ColumnConfig)
    assert_type(ListColumn(default=None), ColumnConfig)
    assert_type(ListColumn(default=["a"]), ColumnConfig)
    assert_type(ListColumn(default=("a", "b")), ColumnConfig)
    assert_type(
        ListColumn(
            "Tags",
            width="medium",
            help="Labels",
            pinned=False,
            disabled=False,
            required=True,
            default=["a", "b"],
        ),
        ColumnConfig,
    )

    # =====================================================================
    # MultiselectColumn
    # =====================================================================

    assert_type(MultiselectColumn(), ColumnConfig)
    assert_type(MultiselectColumn("Tags"), ColumnConfig)
    assert_type(MultiselectColumn(label=None), ColumnConfig)
    assert_type(MultiselectColumn(width="small"), ColumnConfig)
    assert_type(MultiselectColumn(width="large"), ColumnConfig)
    assert_type(MultiselectColumn(width=220), ColumnConfig)
    assert_type(MultiselectColumn(width=None), ColumnConfig)
    assert_type(MultiselectColumn(help=None), ColumnConfig)
    assert_type(MultiselectColumn(disabled=None), ColumnConfig)
    assert_type(MultiselectColumn(required=None), ColumnConfig)
    assert_type(MultiselectColumn(pinned=None), ColumnConfig)
    assert_type(MultiselectColumn(default=None), ColumnConfig)
    assert_type(MultiselectColumn(default=["a"]), ColumnConfig)
    assert_type(MultiselectColumn(options=None), ColumnConfig)
    assert_type(MultiselectColumn(options=["a", "b"]), ColumnConfig)
    assert_type(MultiselectColumn(options=("a", "b")), ColumnConfig)
    assert_type(MultiselectColumn(accept_new_options=None), ColumnConfig)
    assert_type(MultiselectColumn(accept_new_options=True), ColumnConfig)
    assert_type(MultiselectColumn(accept_new_options=False), ColumnConfig)
    assert_type(MultiselectColumn(color=None), ColumnConfig)
    assert_type(MultiselectColumn(color="auto"), ColumnConfig)
    assert_type(MultiselectColumn(color="primary"), ColumnConfig)
    assert_type(MultiselectColumn(color="red"), ColumnConfig)
    assert_type(MultiselectColumn(color="#ffa421"), ColumnConfig)
    assert_type(MultiselectColumn(color=["#ffa421", "red"]), ColumnConfig)
    assert_type(MultiselectColumn(color=("primary", "blue")), ColumnConfig)
    assert_type(MultiselectColumn(color=css_color), ColumnConfig)
    assert_type(MultiselectColumn(format_func=None), ColumnConfig)
    assert_type(MultiselectColumn(format_func=_format_label), ColumnConfig)
    assert_type(
        MultiselectColumn(format_func=lambda option: option.upper()), ColumnConfig
    )
    assert_type(
        MultiselectColumn(
            "Tags",
            width="medium",
            help="Categories",
            disabled=False,
            required=True,
            pinned=False,
            default=["a"],
            options=["a", "b"],
            accept_new_options=True,
            color=["#ffa421", "#803df5"],
            format_func=_format_label,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # DatetimeColumn
    # =====================================================================

    _when = datetime.datetime(2024, 2, 5, 12, 30)
    assert_type(DatetimeColumn(), ColumnConfig)
    assert_type(DatetimeColumn("When"), ColumnConfig)
    assert_type(DatetimeColumn(label=None), ColumnConfig)
    assert_type(DatetimeColumn(width="small"), ColumnConfig)
    assert_type(DatetimeColumn(width="large"), ColumnConfig)
    assert_type(DatetimeColumn(width=180), ColumnConfig)
    assert_type(DatetimeColumn(width=None), ColumnConfig)
    assert_type(DatetimeColumn(help=None), ColumnConfig)
    assert_type(DatetimeColumn(disabled=None), ColumnConfig)
    assert_type(DatetimeColumn(required=None), ColumnConfig)
    assert_type(DatetimeColumn(pinned=None), ColumnConfig)
    assert_type(DatetimeColumn(alignment="left"), ColumnConfig)
    assert_type(DatetimeColumn(alignment=None), ColumnConfig)
    assert_type(DatetimeColumn(default=None), ColumnConfig)
    assert_type(DatetimeColumn(default=_when), ColumnConfig)
    assert_type(DatetimeColumn(format=None), ColumnConfig)
    assert_type(DatetimeColumn(format="localized"), ColumnConfig)
    assert_type(DatetimeColumn(format="distance"), ColumnConfig)
    assert_type(DatetimeColumn(format="calendar"), ColumnConfig)
    assert_type(DatetimeColumn(format="iso8601"), ColumnConfig)
    assert_type(DatetimeColumn(format="D MMM YYYY, h:mm a"), ColumnConfig)
    assert_type(DatetimeColumn(min_value=None), ColumnConfig)
    assert_type(DatetimeColumn(min_value=_when), ColumnConfig)
    assert_type(DatetimeColumn(max_value=None), ColumnConfig)
    assert_type(DatetimeColumn(max_value=_when), ColumnConfig)
    assert_type(DatetimeColumn(step=None), ColumnConfig)
    assert_type(DatetimeColumn(step=60), ColumnConfig)
    assert_type(DatetimeColumn(step=0.5), ColumnConfig)
    assert_type(DatetimeColumn(step=datetime.timedelta(minutes=15)), ColumnConfig)
    assert_type(DatetimeColumn(timezone=None), ColumnConfig)
    assert_type(DatetimeColumn(timezone="UTC"), ColumnConfig)
    assert_type(
        DatetimeColumn(
            "When",
            width="medium",
            help="Appointment",
            disabled=False,
            required=True,
            pinned=False,
            alignment="left",
            default=_when,
            format="localized",
            min_value=_when,
            max_value=_when,
            step=datetime.timedelta(minutes=15),
            timezone="America/Los_Angeles",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # TimeColumn
    # =====================================================================

    _clock = datetime.time(8, 30)
    assert_type(TimeColumn(), ColumnConfig)
    assert_type(TimeColumn("Start"), ColumnConfig)
    assert_type(TimeColumn(label=None), ColumnConfig)
    assert_type(TimeColumn(width="small"), ColumnConfig)
    assert_type(TimeColumn(width="large"), ColumnConfig)
    assert_type(TimeColumn(width=120), ColumnConfig)
    assert_type(TimeColumn(width=None), ColumnConfig)
    assert_type(TimeColumn(help=None), ColumnConfig)
    assert_type(TimeColumn(disabled=None), ColumnConfig)
    assert_type(TimeColumn(required=None), ColumnConfig)
    assert_type(TimeColumn(pinned=None), ColumnConfig)
    assert_type(TimeColumn(alignment="right"), ColumnConfig)
    assert_type(TimeColumn(alignment=None), ColumnConfig)
    assert_type(TimeColumn(default=None), ColumnConfig)
    assert_type(TimeColumn(default=_clock), ColumnConfig)
    assert_type(TimeColumn(format=None), ColumnConfig)
    assert_type(TimeColumn(format="localized"), ColumnConfig)
    assert_type(TimeColumn(format="iso8601"), ColumnConfig)
    assert_type(TimeColumn(format="hh:mm a"), ColumnConfig)
    assert_type(TimeColumn(min_value=None), ColumnConfig)
    assert_type(TimeColumn(min_value=_clock), ColumnConfig)
    assert_type(TimeColumn(max_value=None), ColumnConfig)
    assert_type(TimeColumn(max_value=_clock), ColumnConfig)
    assert_type(TimeColumn(step=None), ColumnConfig)
    assert_type(TimeColumn(step=60), ColumnConfig)
    assert_type(TimeColumn(step=0.5), ColumnConfig)
    assert_type(TimeColumn(step=datetime.timedelta(seconds=30)), ColumnConfig)
    assert_type(
        TimeColumn(
            "Start",
            width="medium",
            help="Opening time",
            disabled=False,
            required=False,
            pinned=False,
            alignment="left",
            default=_clock,
            format="iso8601",
            min_value=_clock,
            max_value=datetime.time(18, 0),
            step=60,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # DateColumn
    # =====================================================================

    _day = datetime.date(2024, 2, 5)
    assert_type(DateColumn(), ColumnConfig)
    assert_type(DateColumn("Day"), ColumnConfig)
    assert_type(DateColumn(label=None), ColumnConfig)
    assert_type(DateColumn(width="small"), ColumnConfig)
    assert_type(DateColumn(width="large"), ColumnConfig)
    assert_type(DateColumn(width=140), ColumnConfig)
    assert_type(DateColumn(width=None), ColumnConfig)
    assert_type(DateColumn(help=None), ColumnConfig)
    assert_type(DateColumn(disabled=None), ColumnConfig)
    assert_type(DateColumn(required=None), ColumnConfig)
    assert_type(DateColumn(pinned=None), ColumnConfig)
    assert_type(DateColumn(alignment="left"), ColumnConfig)
    assert_type(DateColumn(alignment=None), ColumnConfig)
    assert_type(DateColumn(default=None), ColumnConfig)
    assert_type(DateColumn(default=_day), ColumnConfig)
    assert_type(DateColumn(format=None), ColumnConfig)
    assert_type(DateColumn(format="localized"), ColumnConfig)
    assert_type(DateColumn(format="distance"), ColumnConfig)
    assert_type(DateColumn(format="iso8601"), ColumnConfig)
    assert_type(DateColumn(format="DD.MM.YYYY"), ColumnConfig)
    assert_type(DateColumn(min_value=None), ColumnConfig)
    assert_type(DateColumn(min_value=_day), ColumnConfig)
    assert_type(DateColumn(max_value=None), ColumnConfig)
    assert_type(DateColumn(max_value=_day), ColumnConfig)
    assert_type(DateColumn(step=None), ColumnConfig)
    assert_type(DateColumn(step=1), ColumnConfig)
    assert_type(
        DateColumn(
            "Day",
            width="medium",
            help="Birthday",
            disabled=False,
            required=True,
            pinned=False,
            alignment="left",
            default=_day,
            format="localized",
            min_value=datetime.date(1900, 1, 1),
            max_value=_day,
            step=1,
        ),
        ColumnConfig,
    )

    # =====================================================================
    # ProgressColumn
    # =====================================================================

    assert_type(ProgressColumn(), ColumnConfig)
    assert_type(ProgressColumn("Score"), ColumnConfig)
    assert_type(ProgressColumn(label=None), ColumnConfig)
    assert_type(ProgressColumn(width="small"), ColumnConfig)
    assert_type(ProgressColumn(width="medium"), ColumnConfig)
    assert_type(ProgressColumn(width="large"), ColumnConfig)
    assert_type(ProgressColumn(width=100), ColumnConfig)
    assert_type(ProgressColumn(width=None), ColumnConfig)
    assert_type(ProgressColumn(help=None), ColumnConfig)
    assert_type(ProgressColumn(pinned=None), ColumnConfig)
    assert_type(ProgressColumn(format=None), ColumnConfig)
    assert_type(ProgressColumn(format="percent"), ColumnConfig)
    assert_type(ProgressColumn(format="bytes"), ColumnConfig)
    assert_type(ProgressColumn(format="%.0f"), ColumnConfig)
    assert_type(ProgressColumn(min_value=None), ColumnConfig)
    assert_type(ProgressColumn(min_value=0), ColumnConfig)
    assert_type(ProgressColumn(min_value=0.0), ColumnConfig)
    assert_type(ProgressColumn(max_value=None), ColumnConfig)
    assert_type(ProgressColumn(max_value=1), ColumnConfig)
    assert_type(ProgressColumn(max_value=1.0), ColumnConfig)
    assert_type(ProgressColumn(step=None), ColumnConfig)
    assert_type(ProgressColumn(step=0.1), ColumnConfig)
    assert_type(ProgressColumn(color=None), ColumnConfig)
    assert_type(ProgressColumn(color="auto"), ColumnConfig)
    assert_type(ProgressColumn(color="auto-inverse"), ColumnConfig)
    assert_type(ProgressColumn(color="primary"), ColumnConfig)
    assert_type(ProgressColumn(color=css_color), ColumnConfig)
    assert_type(
        ProgressColumn(
            "Score",
            width="medium",
            help="Completion",
            pinned=False,
            format="percent",
            min_value=0,
            max_value=1.0,
            step=0.01,
            color="auto",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # JsonColumn
    # =====================================================================

    assert_type(JsonColumn(), ColumnConfig)
    assert_type(JsonColumn("Payload"), ColumnConfig)
    assert_type(JsonColumn(label=None), ColumnConfig)
    assert_type(JsonColumn(width="small"), ColumnConfig)
    assert_type(JsonColumn(width="large"), ColumnConfig)
    assert_type(JsonColumn(width=240), ColumnConfig)
    assert_type(JsonColumn(width=None), ColumnConfig)
    assert_type(JsonColumn(help=None), ColumnConfig)
    assert_type(JsonColumn(pinned=None), ColumnConfig)
    assert_type(JsonColumn(alignment="left"), ColumnConfig)
    assert_type(JsonColumn(alignment="center"), ColumnConfig)
    assert_type(JsonColumn(alignment="right"), ColumnConfig)
    assert_type(JsonColumn(alignment=None), ColumnConfig)
    assert_type(
        JsonColumn(
            "Payload",
            width="large",
            help="Raw JSON",
            pinned=False,
            alignment="left",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # MarkdownColumn
    # =====================================================================

    assert_type(MarkdownColumn(), ColumnConfig)
    assert_type(MarkdownColumn("Body"), ColumnConfig)
    assert_type(MarkdownColumn(label=None), ColumnConfig)
    assert_type(MarkdownColumn(width="small"), ColumnConfig)
    assert_type(MarkdownColumn(width="large"), ColumnConfig)
    assert_type(MarkdownColumn(width=300), ColumnConfig)
    assert_type(MarkdownColumn(width=None), ColumnConfig)
    assert_type(MarkdownColumn(help=None), ColumnConfig)
    assert_type(MarkdownColumn(disabled=None), ColumnConfig)
    assert_type(MarkdownColumn(required=None), ColumnConfig)
    assert_type(MarkdownColumn(pinned=None), ColumnConfig)
    assert_type(MarkdownColumn(alignment="left"), ColumnConfig)
    assert_type(MarkdownColumn(alignment=None), ColumnConfig)
    assert_type(MarkdownColumn(default=None), ColumnConfig)
    assert_type(MarkdownColumn(default="**bold**"), ColumnConfig)
    assert_type(
        MarkdownColumn(
            "Body",
            width="medium",
            help="Markdown",
            disabled=True,
            required=False,
            pinned=False,
            alignment="left",
            default="",
        ),
        ColumnConfig,
    )

    # =====================================================================
    # ButtonColumn
    # Without key: ColumnConfig. With key: ButtonColumnResult.
    # =====================================================================

    assert_type(ButtonColumn(), ColumnConfig)
    assert_type(ButtonColumn("Actions"), ColumnConfig)
    assert_type(ButtonColumn(label="Actions"), ColumnConfig)
    assert_type(ButtonColumn(label=None), ColumnConfig)
    assert_type(ButtonColumn(""), ColumnConfig)
    assert_type(ButtonColumn(width="small"), ColumnConfig)
    assert_type(ButtonColumn(width="medium"), ColumnConfig)
    assert_type(ButtonColumn(width="large"), ColumnConfig)
    assert_type(ButtonColumn(width=100), ColumnConfig)
    assert_type(ButtonColumn(width=None), ColumnConfig)
    assert_type(ButtonColumn(help=None), ColumnConfig)
    assert_type(ButtonColumn(help="Click to perform action"), ColumnConfig)
    assert_type(ButtonColumn(pinned=None), ColumnConfig)
    assert_type(ButtonColumn(pinned=True), ColumnConfig)
    assert_type(ButtonColumn(pinned=False), ColumnConfig)
    assert_type(ButtonColumn(alignment=None), ColumnConfig)
    assert_type(ButtonColumn(alignment="left"), ColumnConfig)
    assert_type(ButtonColumn(alignment="center"), ColumnConfig)
    assert_type(ButtonColumn(alignment="right"), ColumnConfig)
    assert_type(ButtonColumn(type="primary"), ColumnConfig)
    assert_type(ButtonColumn(type="secondary"), ColumnConfig)
    assert_type(ButtonColumn(type="tertiary"), ColumnConfig)
    assert_type(ButtonColumn(key="btn_click"), ButtonColumnResult)
    assert_type(ButtonColumn("Actions", key="btn_click"), ButtonColumnResult)
    key_name: str = "btn_click"
    assert_type(ButtonColumn(key=key_name), ButtonColumnResult)
    dynamic_key: str | None = "btn_click"
    # ty infers ButtonColumnResult for a non-literal `str | None` key.
    assert_type(  # ty: ignore[type-assertion-failure]
        ButtonColumn(key=dynamic_key), ButtonColumnResult | ColumnConfig
    )
    assert_type(ButtonColumn(on_click=_on_click, key="click"), ButtonColumnResult)
    assert_type(
        ButtonColumn(on_click=_on_click_with_args, key="click"), ButtonColumnResult
    )
    assert_type(ButtonColumn(on_click=lambda: None, key="click"), ButtonColumnResult)
    assert_type(ButtonColumn(on_click=None, key="click"), ButtonColumnResult)
    assert_type(
        ButtonColumn(on_click=_on_click_with_args, args=(1, "a"), key="click"),
        ButtonColumnResult,
    )
    assert_type(
        ButtonColumn(
            on_click=_on_click_with_args, kwargs={"x": 1, "y": "a"}, key="click"
        ),
        ButtonColumnResult,
    )
    assert_type(
        ButtonColumn(
            on_click=_on_click_with_args, args=(1, "a"), kwargs={}, key="click"
        ),
        ButtonColumnResult,
    )
    assert_type(
        ButtonColumn(
            label="Actions",
            width="medium",
            help="Click to perform action",
            pinned=False,
            alignment="center",
            type="primary",
        ),
        ColumnConfig,
    )
    assert_type(
        ButtonColumn(
            label="Actions",
            width="medium",
            help="Click to perform action",
            pinned=False,
            alignment="center",
            type="primary",
            on_click=_on_click,
            args=None,
            kwargs=None,
            key="action_click",
        ),
        ButtonColumnResult,
    )

    # Every helper is accepted by st.dataframe / st.data_editor column_config.
    _column_config: ColumnConfigMappingInput = {
        "generic": Column("Name"),
        "number": NumberColumn("Amount", format="dollar"),
        "text": TextColumn("Note"),
        "link": LinkColumn("Site", display_text="Open"),
        "checkbox": CheckboxColumn("Done", default=False),
        "selectbox": SelectboxColumn("Category", options=["a", "b"]),
        "bar": BarChartColumn("Sales", y_min=0, y_max=100),
        "line": LineChartColumn("Sales", color="auto"),
        "area": AreaChartColumn("Sales", color="#483d8b"),
        "image": ImageColumn("Preview"),
        "audio": AudioColumn("Clip"),
        "video": VideoColumn("Clip"),
        "list": ListColumn("Tags", default=["a"]),
        "multiselect": MultiselectColumn("Tags", options=["a"], color="auto"),
        "datetime": DatetimeColumn("When", format="iso8601"),
        "time": TimeColumn("Start", format="localized"),
        "date": DateColumn("Day", format="distance"),
        "progress": ProgressColumn("Score", format="percent"),
        "json": JsonColumn("Payload"),
        "markdown": MarkdownColumn("Body"),
        "button": ButtonColumn("Actions", key="action_click"),
    }

    # =====================================================================
    # Invalid usages
    # =====================================================================

    # Only label is positional. Width is a size name or a pixel count.
    Column("Name", "medium")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    Column(width="stretch")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    Column(width=100.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    Column(alignment="justify")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    plain_width: str = "small"
    Column(width=plain_width)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    NumberColumn(format=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    NumberColumn(min_value="0")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    NumberColumn(step="1")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    TextColumn(max_chars=1.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    TextColumn(default=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    LinkColumn(display_text=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    CheckboxColumn(default="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    # Selectbox columns have no alignment parameter.
    SelectboxColumn(alignment="left")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    SelectboxColumn(options=[object()])  # type: ignore[list-item]  # ty: ignore[invalid-argument-type]

    # Chart columns are not editable and have no alignment parameter.
    BarChartColumn(y_min="0")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    BarChartColumn(color=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    BarChartColumn(alignment="center")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    LineChartColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    AreaChartColumn("Sales", "medium")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    AreaChartColumn(width="stretch")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(width=100.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(width=plain_width)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(y_min="0")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(color=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    AreaChartColumn(alignment="center")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    AreaChartColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    ImageColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    AudioColumn(color="auto")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    VideoColumn(alignment="justify")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    ListColumn(default=[1])  # type: ignore[list-item]  # ty: ignore[invalid-argument-type]
    ListColumn(alignment="left")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    MultiselectColumn(options=[1])  # type: ignore[list-item]  # ty: ignore[invalid-argument-type]
    MultiselectColumn(color=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    DatetimeColumn(default="2024-02-05")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    DatetimeColumn(min_value=_day)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    TimeColumn(default=_day)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    # Date steps are whole days, not durations.
    DateColumn(step=1.5)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    DateColumn(step=datetime.timedelta(days=1))  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Progress columns are not editable.
    ProgressColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    ProgressColumn(color=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    JsonColumn(disabled=True)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    MarkdownColumn(default=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    ButtonColumn(type="other")  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    # ty accepts a non-literal str for `type`; mypy does not.
    button_type: str = "primary"
    ButtonColumn(type=button_type)  # type: ignore[call-overload]
    ButtonColumn(key=1)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
    # Callbacks require a key, matching the runtime error.
    ButtonColumn(on_click=_on_click)  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    ButtonColumn(args=(1,))  # type: ignore[call-overload]  # ty: ignore[invalid-argument-type]
    ButtonColumn(disabled=True)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
