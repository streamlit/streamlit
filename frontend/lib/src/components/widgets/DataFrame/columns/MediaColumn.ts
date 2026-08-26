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

import { MediaCell, MediaType } from "./cells/MediaCell"
import { BaseColumn, BaseColumnProps, toSafeString } from "./utils"

const MEDIA_ICONS: Record<MediaType, string> = {
  audio: ":material/audio_file:",
  video: ":material/video_file:",
}

/**
 * Base column type for media columns (audio and video).
 * Renders a media player in the cell overlay.
 * The cell displays a material icon to indicate media content.
 *
 * This column type is currently read-only.
 */
function BaseMediaColumn(
  mediaType: MediaType,
  props: BaseColumnProps
): BaseColumn {
  const cellTemplate: MediaCell = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "center",
    readonly: true,
    copyData: "",
    data: {
      kind: "media-cell",
      mediaType,
      src: null,
    },
  }

  return {
    ...props,
    kind: mediaType,
    typeIcon: MEDIA_ICONS[mediaType],
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      const src = notNullOrUndefined(data) ? toSafeString(data) : null

      return {
        ...cellTemplate,
        copyData: src ?? "",
        isMissingValue: isNullOrUndefined(data),
        data: {
          kind: "media-cell",
          mediaType,
          src,
        },
      } as MediaCell
    },
    getCellValue(cell: MediaCell): string | null {
      return cell.data?.src ?? null
    },
  }
}

/**
 * A column type that renders an audio player in the cell overlay.
 * The cell displays a material icon (audio_file) to indicate audio content.
 *
 * This column type is currently read-only.
 */
export function AudioColumn(props: BaseColumnProps): BaseColumn {
  return BaseMediaColumn("audio", props)
}

AudioColumn.isEditableType = false

/**
 * A column type that renders a video player in the cell overlay.
 * The cell displays a material icon (video_file) to indicate video content.
 *
 * This column type is currently read-only.
 */
export function VideoColumn(props: BaseColumnProps): BaseColumn {
  return BaseMediaColumn("video", props)
}

VideoColumn.isEditableType = false
