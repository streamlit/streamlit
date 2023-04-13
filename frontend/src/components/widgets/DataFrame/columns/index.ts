/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ObjectColumn from "./ObjectColumn"
import TextColumn from "./TextColumn"
import CheckboxColumn from "./CheckboxColumn"
import SelectColumn from "./SelectColumn"
import ListColumn from "./ListColumn"
import NumberColumn from "./NumberColumn"
import { DateTimeColumn, TimeColumn, DateColumn } from "./DateTimeColumn"
import { LineChartColumn, BarChartColumn } from "./ChartColumn"
import UrlColumn from "./UrlColumn"
import ImageColumn from "./ImageColumn"
import RangeColumn from "./RangeColumn"

import DatePickerCell from "./cells/DatePickerCell"

import { ColumnCreator } from "./utils"

export * from "./utils"

/**
 * All available column types need to be registered here.
 */
export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    object: ObjectColumn,
    text: TextColumn,
    number: NumberColumn,
    checkbox: CheckboxColumn,
    select: SelectColumn,
    date: DateColumn,
    datetime: DateTimeColumn,
    time: TimeColumn,
    list: ListColumn,
    line_chart: LineChartColumn,
    bar_chart: BarChartColumn,
    url: UrlColumn,
    image: ImageColumn,
    range: RangeColumn,
  })
)

export const CustomCells = [DatePickerCell]

export {
  ObjectColumn,
  TextColumn,
  CheckboxColumn,
  SelectColumn,
  DateColumn,
  DateTimeColumn,
  TimeColumn,
  ListColumn,
  NumberColumn,
  LineChartColumn,
  BarChartColumn,
  UrlColumn,
  ImageColumn,
  RangeColumn,
}
