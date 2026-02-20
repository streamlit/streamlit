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

import { convertRemToPx } from "~lib/theme"
import { genericFonts } from "~lib/theme/primitives/typography"

export type MediaType = "audio" | "video"

interface MediaCellProps {
  readonly kind: "media-cell"
  /** The media type: "audio" or "video". */
  readonly mediaType: MediaType
  /** The media source URL or data URI. */
  readonly src: string | null
}

export type MediaCell = CustomCell<MediaCellProps>

const MEDIA_ICONS: Record<MediaType, string> = {
  audio: "audio_file",
  video: "video_file",
}

const StyledAudio = styled.audio({
  width: "100%",
  // minWidth ensures the player controls remain usable
  minWidth: "18.75rem",
})

const StyledVideo = styled.video({
  maxWidth: "25rem",
  maxHeight: "18.75rem",
  width: "100%",
})

/**
 * The cell overlay editor used by media columns to render
 * the audio or video player.
 */
export const MediaCellEditor: ReturnType<
  ProvideEditorCallback<MediaCell>
> = cell => {
  const { src, mediaType } = cell.value.data

  if (!src) {
    return null
  }

  if (mediaType === "audio") {
    return <StyledAudio src={src} controls autoPlay={false} />
  }

  return <StyledVideo src={src} controls autoPlay={false} />
}

const ICON_FONT_SIZE = "1.25rem"
const ICON_FONT_WEIGHT = 300

/**
 * The media cell renderer used by audio and video columns.
 */
const renderer: CustomRenderer<MediaCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is MediaCell =>
    (c.data as MediaCellProps).kind === "media-cell",
  draw: (args, cell) => {
    const { ctx, theme, rect } = args
    const { src, mediaType } = cell.data
    if (!src) {
      return true
    }

    const icon = MEDIA_ICONS[mediaType]
    const iconFontSizePx = convertRemToPx(ICON_FONT_SIZE)

    ctx.save()
    ctx.font = `${ICON_FONT_WEIGHT} ${iconFontSizePx}px ${genericFonts.iconFont}`
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

    ctx.fillText(icon, x, y)
    ctx.restore()
    return true
  },
  measure: (ctx, cell, theme) => {
    const icon = MEDIA_ICONS[cell.data.mediaType]
    const iconFontSizePx = convertRemToPx(ICON_FONT_SIZE)
    ctx.font = `${ICON_FONT_WEIGHT} ${iconFontSizePx}px ${genericFonts.iconFont}`
    return ctx.measureText(icon).width + theme.cellHorizontalPadding * 2
  },
  provideEditor: () => ({
    editor: MediaCellEditor,
  }),
}

export default renderer
