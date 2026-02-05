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

import { type GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import { notNullOrUndefined } from "~lib/util/utils"

import type { AudioCell } from "./cells/AudioCell"
import type { BaseColumn, BaseColumnProps } from "./utils"
import { toSafeString } from "./utils"

/**
 * Column type that renders an audio player for each cell.
 * This column type is read-only.
 */
const MAX_TOOLTIP_URL_LENGTH = 256

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  // Leave room for the ellipsis character.
  const available = maxLength - 1
  const head = Math.ceil(available / 2)
  const tail = Math.floor(available / 2)
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`
}

function getAudioDisplayValue(url: string | null): string {
  if (!url) {
    return ""
  }

  if (url.startsWith("data:")) {
    return "Audio: data URL"
  }

  // Prefer a concise "host/file" representation for absolute URLs.
  try {
    const parsed = new URL(url)
    const filename =
      parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.pathname
    const label = filename ? `${parsed.host}/${filename}` : parsed.host
    return `Audio: ${label}`
  } catch {
    // Not an absolute URL (e.g. relative URL). Keep it short and readable.
    return `Audio: ${truncateMiddle(url, 60)}`
  }
}

function getAudioTooltip(url: string | null): string | undefined {
  if (!url) {
    return undefined
  }

  if (url.startsWith("data:")) {
    // Data URLs can be extremely long. Avoid putting the whole value into a tooltip.
    return `Audio data URL (${url.length.toLocaleString()} chars). Double-click to open the player.`
  }

  const shortUrl = truncateMiddle(url, MAX_TOOLTIP_URL_LENGTH)
  return `${shortUrl} • Double-click to open the player.`
}

function AudioColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: AudioCell = {
    kind: GridCellKind.Custom,
    data: { kind: "audio-cell", url: null },
    copyData: "",
    readonly: true,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "center",
    style: "normal",
  }

  return {
    ...props,
    kind: "audio",
    typeIcon: ":material/audiotrack:",
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      const url = notNullOrUndefined(data) ? toSafeString(data) : null
      const displayValue = getAudioDisplayValue(url)
      const tooltip = getAudioTooltip(url)

      return {
        ...cellTemplate,
        data: { ...cellTemplate.data, url, displayValue },
        copyData: url ?? "",
        ...(tooltip ? { tooltip } : {}),
      }
    },
    getCellValue(cell: AudioCell): string | null {
      return cell.data.url ?? null
    },
  }
}

AudioColumn.isEditableType = false

export default AudioColumn
