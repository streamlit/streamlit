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
import SelectboxColumn from "./SelectboxColumn"
import ListColumn from "./ListColumn"
import NumberColumn from "./NumberColumn"

import { ColumnCreator } from "./utils"

export * from "./utils"

/**
 * All available column types need to be registered here.
 */
export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    object: ObjectColumn,
    text: TextColumn,
    checkbox: CheckboxColumn,
    selectbox: SelectboxColumn,
    list: ListColumn,
    number: NumberColumn,
  })
)

export {
  ObjectColumn,
  TextColumn,
  CheckboxColumn,
  SelectboxColumn,
  ListColumn,
  NumberColumn,
}
