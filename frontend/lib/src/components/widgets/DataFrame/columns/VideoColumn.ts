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

import { VideoCell } from "./cells/VideoCell"
import { BaseColumn, BaseColumnProps, toSafeString } from "./utils"

/**
 * A column type that renders a video player in the cell overlay.
 * The cell displays a material icon (hangout_video) to indicate video content.
 *
 * This column type is currently read-only.
 */
function VideoColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: VideoCell = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "center",
    readonly: true,
    copyData: "",
    data: {
      kind: "video-cell",
      src: null,
    },
  }

  return {
    ...props,
    kind: "video",
    typeIcon: ":material/hangout_video:",
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      const src = notNullOrUndefined(data) ? toSafeString(data) : null

      return {
        ...cellTemplate,
        copyData: src ?? "",
        isMissingValue: isNullOrUndefined(data),
        data: {
          kind: "video-cell",
          src,
        },
      } as VideoCell
    },
    getCellValue(cell: VideoCell): string | null {
      return cell.data?.src ?? null
    },
  }
}

VideoColumn.isEditableType = false

export default VideoColumn
