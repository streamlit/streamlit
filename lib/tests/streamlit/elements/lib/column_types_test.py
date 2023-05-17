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

import datetime
import unittest

from streamlit.elements.lib.column_types import (
    BarChartColumn,
    CheckboxColumn,
    Column,
    DateColumn,
    DatetimeColumn,
    ImageColumn,
    LineChartColumn,
    LinkColumn,
    ListColumn,
    NumberColumn,
    ProgressColumn,
    SelectboxColumn,
    TextColumn,
    TimeColumn,
)
from streamlit.elements.lib.dicttools import remove_none_values


class ColumnTypesTest(unittest.TestCase):
    def test_generic_column(self):
        """Test Column creation."""

        self.assertEqual(
            remove_none_values(Column()),
            {},
            "Should not have any properties defined.",
        )

        self.assertEqual(
            remove_none_values(
                Column(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
            },
            "Should have all the properties defined.",
        )

    def test_number_column(self):
        """Test NumberColumn creation."""
        self.assertEqual(
            remove_none_values(NumberColumn()),
            {"type_config": {"type": "number"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                NumberColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default=50,
                    min_value=0,
                    max_value=100,
                    step=1,
                    format="%.2f",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": 50,
                "type_config": {
                    "type": "number",
                    "format": "%.2f",
                    "max_value": 100,
                    "min_value": 0,
                    "step": 1,
                },
            },
            "Should have all the properties defined.",
        )

    def test_text_column(self):
        """Test TextColumn creation."""

        self.assertEqual(
            remove_none_values(TextColumn()),
            {"type_config": {"type": "text"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                TextColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default="default",
                    max_chars=10,
                    validate="^[a-zA-Z]+$",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "default",
                "type_config": {
                    "type": "text",
                    "max_chars": 10,
                    "validate": "^[a-zA-Z]+$",
                },
            },
            "Should have all the properties defined.",
        )

    def test_checkbox_column(self):
        """Test CheckboxColumn creation."""

        self.assertEqual(
            remove_none_values(CheckboxColumn()),
            {"type_config": {"type": "checkbox"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                CheckboxColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default=True,
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": True,
                "type_config": {"type": "checkbox"},
            },
            "Should have all the properties defined.",
        )

    def test_selectbox_column(self):
        """Test SelectboxColumn creation."""

        self.assertEqual(
            remove_none_values(SelectboxColumn()),
            {"type_config": {"type": "selectbox"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                SelectboxColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default="a",
                    options=["a", "b", "c"],
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "a",
                "type_config": {"type": "selectbox", "options": ["a", "b", "c"]},
            },
            "Should have all the properties defined.",
        )

    def test_datetime_column(self):
        """Test DatetimeColumn creation."""

        self.assertEqual(
            remove_none_values(DatetimeColumn()),
            {"type_config": {"type": "datetime"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                DatetimeColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default=datetime.datetime(2021, 1, 1),
                    min_value=datetime.datetime(2020, 1, 1),
                    max_value=datetime.datetime(2022, 1, 2),
                    step=datetime.timedelta(milliseconds=100),
                    format="yyyy-MM-dd",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "2021-01-01T00:00:00",
                "type_config": {
                    "type": "datetime",
                    "format": "yyyy-MM-dd",
                    "max_value": "2022-01-02T00:00:00",
                    "min_value": "2020-01-01T00:00:00",
                    "step": 0.1,
                },
            },
            "Should have all the properties defined.",
        )

    def test_time_column(self):
        """Test TimeColumn creation."""

        self.assertEqual(
            remove_none_values(TimeColumn()),
            {"type_config": {"type": "time"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                TimeColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default=datetime.time(12, 0),
                    min_value=datetime.time(0, 0),
                    max_value=datetime.time(23, 59),
                    step=datetime.timedelta(milliseconds=100),
                    format="HH:mm",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "12:00:00",
                "type_config": {
                    "type": "time",
                    "format": "HH:mm",
                    "max_value": "23:59:00",
                    "min_value": "00:00:00",
                    "step": 0.1,
                },
            },
            "Should have all the properties defined.",
        )

    def test_date_column(self):
        """Test DateColumn creation."""

        self.assertEqual(
            remove_none_values(DateColumn()),
            {"type_config": {"type": "date"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                DateColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default=datetime.date(2021, 1, 1),
                    min_value=datetime.date(2020, 1, 1),
                    max_value=datetime.date(2022, 1, 2),
                    step=1,
                    format="yyyy-MM-dd",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "2021-01-01",
                "type_config": {
                    "type": "date",
                    "format": "yyyy-MM-dd",
                    "min_value": "2020-01-01",
                    "max_value": "2022-01-02",
                    "step": 1,
                },
            },
            "Should have all the properties defined.",
        )

    def test_progress_column(self):
        """Test ProgressColumn creation."""

        self.assertEqual(
            remove_none_values(ProgressColumn()),
            {"type_config": {"type": "progress"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                ProgressColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    min_value=0,
                    max_value=100,
                    format="%.1f%%",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "type_config": {
                    "type": "progress",
                    "format": "%.1f%%",
                    "min_value": 0,
                    "max_value": 100,
                },
            },
            "Should have all the properties defined.",
        )

    def test_line_chart_column(self):
        """Test LineChartColumn creation."""

        self.assertEqual(
            remove_none_values(LineChartColumn()),
            {"type_config": {"type": "line_chart"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                LineChartColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    y_min=0,
                    y_max=100,
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "type_config": {"type": "line_chart", "y_min": 0, "y_max": 100},
            },
            "Should have all the properties defined.",
        )

    def test_bar_chart_column(self):
        """Test BarChartColumn creation."""

        self.assertEqual(
            remove_none_values(BarChartColumn()),
            {"type_config": {"type": "bar_chart"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                BarChartColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    y_min=0,
                    y_max=100,
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "type_config": {"type": "bar_chart", "y_min": 0, "y_max": 100},
            },
            "Should have all the properties defined.",
        )

    def test_link_column(self):
        """Test LinkColumn creation."""

        self.assertEqual(
            remove_none_values(LinkColumn()),
            {"type_config": {"type": "link"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                LinkColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                    disabled=False,
                    required=True,
                    default="https://streamlit.io/",
                    max_chars=100,
                    validate="^[a-zA-Z]+$",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "disabled": False,
                "required": True,
                "default": "https://streamlit.io/",
                "type_config": {
                    "type": "link",
                    "max_chars": 100,
                    "validate": "^[a-zA-Z]+$",
                },
            },
            "Should have all the properties defined.",
        )

    def test_list_column(self):
        """Test ListColumn creation."""

        self.assertEqual(
            remove_none_values(ListColumn()),
            {"type_config": {"type": "list"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(
                ListColumn(
                    "Col1",
                    width="small",
                    help="Help text",
                )
            ),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "type_config": {
                    "type": "list",
                },
            },
            "Should have all the properties defined.",
        )

    def test_image_column(self):
        """Test ImageColumn creation."""

        self.assertEqual(
            remove_none_values(ImageColumn()),
            {"type_config": {"type": "image"}},
            "Should only have the type defined and nothing else.",
        )

        self.assertEqual(
            remove_none_values(ImageColumn("Col1", width="small", help="Help text")),
            {
                "label": "Col1",
                "width": "small",
                "help": "Help text",
                "type_config": {
                    "type": "image",
                },
            },
            "Should have all the properties defined.",
        )
