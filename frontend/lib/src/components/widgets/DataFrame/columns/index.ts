/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import JsonCellRenderer from "./cells/JsonCell"
import {
  AreaChartColumn,
  BarChartColumn,
  LineChartColumn,
} from "./ChartColumn"
import CheckboxColumn from "./CheckboxColumn"
import DateTimeColumn, { DateColumn, TimeColumn } from "./DateTimeColumn"
import ImageColumn from "./ImageColumn"
import JsonColumn from "./JsonColumn"
import LinkColumn from "./LinkColumn"
import ListColumn from "./ListColumn"
import NumberColumn from "./NumberColumn"
import ObjectColumn from "./ObjectColumn"
import ProgressColumn from "./ProgressColumn"
import SelectboxColumn from "./SelectboxColumn"
import TextColumn from "./TextColumn"
import { ColumnCreator } from "./utils"

export { ImageCellEditor } from "./cells/ImageCellEditor"
export type { JsonCell } from "./cells/JsonCell"
export type { DateTimeColumnParams } from "./DateTimeColumn"
export type { LinkColumnParams } from "./LinkColumn"
export type { NumberColumnParams } from "./NumberColumn"

export * from "./utils"

/**
 * Mapping of column types to icons.
 */
export const COLUMN_TYPE_ICONS: Record<string, string> = {
  object: ":material/data_object:",
  text: ":material/notes:",
  checkbox: ":material/check_box:",
  selectbox: ":material/arrow_drop_down_circle:",
  list: ":material/list:",
  number: ":material/tag:",
  link: ":material/link:",
  datetime: ":material/calendar_today:",
  date: ":material/calendar_month:",
  time: ":material/access_time:",
  line_chart: ":material/show_chart:",
  bar_chart: ":material/bar_chart:",
  area_chart: ":material/area_chart:",
  image: ":material/image:",
  progress: ":material/commit:",
  json: ":material/code_blocks:",
}

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
    json: JsonColumn,
  })
)

export const CustomCells = [JsonCellRenderer]

export {
  AreaChartColumn,
  BarChartColumn,
  CheckboxColumn,
  DateColumn,
  DateTimeColumn,
  ImageColumn,
  JsonColumn,
  LineChartColumn,
  LinkColumn,
  ListColumn,
  NumberColumn,
  ObjectColumn,
  ProgressColumn,
  SelectboxColumn,
  TextColumn,
  TimeColumn,
}
