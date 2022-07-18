/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { List, Record, RecordOf } from "immutable"

interface IRawCellModel {
  visible: boolean
  body: string
}

export const CellModel = Record({
  visible: false,
  body: "",
})

export type ICellModel = RecordOf<IRawCellModel>

export type INotebookModel = List<ICellModel>

// This represents holds the code that the user is editing.
// (i.e. the server-side code may be older, or even newer if someone else edited it)
export function NotebookModel(initStates?: ICellModel[]): INotebookModel {
  if (initStates) {
    return List<ICellModel>(initStates)
  }

  return List<ICellModel>()
}
