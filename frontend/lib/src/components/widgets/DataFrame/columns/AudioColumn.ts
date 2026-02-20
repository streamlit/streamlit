/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import { AudioCell } from "./cells/AudioCell"
import { BaseColumn, BaseColumnProps, toSafeString } from "./utils"

/**
 * A column type that renders an audio player in the cell overlay.
 * The cell displays a material icon (music_video) to indicate audio content.
 *
 * This column type is currently read-only.
 */
function AudioColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: AudioCell = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "center",
    readonly: true,
    copyData: "",
    data: {
      kind: "audio-cell",
      src: null,
    },
  }

  return {
    ...props,
    kind: "audio",
    typeIcon: ":material/music_video:",
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      const src = notNullOrUndefined(data) ? toSafeString(data) : null

      return {
        ...cellTemplate,
        copyData: src ?? "",
        isMissingValue: isNullOrUndefined(data),
        data: {
          kind: "audio-cell",
          src,
        },
      } as AudioCell
    },
    getCellValue(cell: AudioCell): string | null {
      return cell.data?.src ?? null
    },
  }
}

AudioColumn.isEditableType = false

export default AudioColumn
