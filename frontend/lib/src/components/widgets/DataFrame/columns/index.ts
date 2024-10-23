/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import {
  AreaChartColumn,
  BarChartColumn,
  LineChartColumn,
} from "./ChartColumn"
import CheckboxColumn from "./CheckboxColumn"
import DateTimeColumn, { DateColumn, TimeColumn } from "./DateTimeColumn"
import ImageColumn from "./ImageColumn"
import LinkColumn from "./LinkColumn"
import ListColumn from "./ListColumn"
import MultiSelectColumn from "./MultiSelectColumn"
import NumberColumn from "./NumberColumn"
import ObjectColumn from "./ObjectColumn"
import ProgressColumn from "./ProgressColumn"
import SelectboxColumn from "./SelectboxColumn"
import TextColumn from "./TextColumn"
import { ColumnCreator } from "./utils"

export { ImageCellEditor } from "./cells/ImageCellEditor"
export type { DateTimeColumnParams } from "./DateTimeColumn"
export type { LinkColumnParams } from "./LinkColumn"
export type { NumberColumnParams } from "./NumberColumn"

export * from "./utils"

/**
 * All available column types need to be registered here.
 *
 * These names must match the column names used in the backend.
 */
export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    object: ObjectColumn,
    text: TextColumn,
    checkbox: CheckboxColumn,
    selectbox: SelectboxColumn,
    list: ListColumn,
    multiselect: MultiSelectColumn,
    number: NumberColumn,
    link: LinkColumn,
    datetime: DateTimeColumn,
    date: DateColumn,
    time: TimeColumn,
    line_chart: LineChartColumn,
    bar_chart: BarChartColumn,
    area_chart: AreaChartColumn,
    image: ImageColumn,
    progress: ProgressColumn,
  })
)

export const CustomCells = []

export {
  AreaChartColumn,
  BarChartColumn,
  CheckboxColumn,
  DateColumn,
  DateTimeColumn,
  ImageColumn,
  LineChartColumn,
  LinkColumn,
  ListColumn,
  MultiSelectColumn,
  NumberColumn,
  ObjectColumn,
  ProgressColumn,
  SelectboxColumn,
  TextColumn,
  TimeColumn,
}
