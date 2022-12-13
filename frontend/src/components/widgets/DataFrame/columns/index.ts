/**
import NumberColumn from '../columns/NumberColumn';
import ObjectColumn from '../columns/ObjectColumn';
import RangeColumn from '../columns/RangeColumn';
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

export * from "./utils"

import { ColumnCreator } from "./utils"
import ObjectColumn from "./ObjectColumn"
import TextColumn from "./TextColumn"
import BooleanColumn from "./BooleanColumn"
import CategoricalColumn from "./CategoricalColumn"
import ListColumn from "./ListColumn"
import NumberColumn from "./NumberColumn"
import RangeColumn from "./RangeColumn"
import ImageColumn from "./ImageColumn"
import ChartColumn from "./ChartColumn"
import UrlColumn from "./UrlColumn"

export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    object: ObjectColumn,
    text: TextColumn,
    boolean: BooleanColumn,
    categorical: CategoricalColumn,
    list: ListColumn,
    number: NumberColumn,
    range: RangeColumn,
    image: ImageColumn,
    chart: ChartColumn,
    url: UrlColumn,
  })
)

export {
  ObjectColumn,
  TextColumn,
  BooleanColumn,
  CategoricalColumn,
  ListColumn,
  NumberColumn,
  RangeColumn,
  ImageColumn,
  ChartColumn,
  UrlColumn,
}
