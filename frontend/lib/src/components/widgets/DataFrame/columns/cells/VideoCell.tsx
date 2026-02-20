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

import styled from "@emotion/styled"
import {
  type CustomCell,
  type CustomRenderer,
  GridCellKind,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid"

import { genericFonts } from "~lib/theme/primitives/typography"

interface VideoCellProps {
  readonly kind: "video-cell"
  /** The video source URL or data URI. */
  readonly src: string | null
}

export type VideoCell = CustomCell<VideoCellProps>

const StyledVideo = styled.video({
  maxWidth: "400px",
  maxHeight: "300px",
  width: "100%",
})

/**
 * The cell overlay editor used by video columns to render
 * the video player.
 */
export const VideoCellEditor: ReturnType<
  ProvideEditorCallback<VideoCell>
> = cell => {
  const src = cell.value.data.src

  if (!src) {
    return null
  }

  return <StyledVideo src={src} controls autoPlay={false} />
}

const ICON_FONT_SIZE = "18px"
export const VIDEO_CELL_ICON = "hangout_video"

/**
 * The video cell renderer used by the video column.
 */
const renderer: CustomRenderer<VideoCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is VideoCell =>
    (c.data as VideoCellProps).kind === "video-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect } = args
    const { src } = cell.data
    if (!src) {
      return true
    }

    ctx.save()
    ctx.font = `${ICON_FONT_SIZE} ${genericFonts.iconFont}`
    ctx.fillStyle = theme.textDark
    ctx.textAlign = cell.contentAlign || "center"
    ctx.textBaseline = "middle"

    const x =
      cell.contentAlign === "left"
        ? rect.x + theme.cellHorizontalPadding
        : cell.contentAlign === "right"
          ? rect.x + rect.width - theme.cellHorizontalPadding
          : rect.x + rect.width / 2
    const y = rect.y + rect.height / 2

    ctx.fillText(VIDEO_CELL_ICON, x, y)
    ctx.restore()
    return true
  },
  measure: (ctx, _cell, theme) => {
    ctx.font = `${ICON_FONT_SIZE} ${genericFonts.iconFont}`
    return (
      ctx.measureText(VIDEO_CELL_ICON).width + theme.cellHorizontalPadding * 2
    )
  },
  provideEditor: () => ({
    editor: VideoCellEditor,
  }),
}

export default renderer
