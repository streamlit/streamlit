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
  drawTextCell,
  GridCellKind,
  type ProvideEditorComponent,
} from "@glideapps/glide-data-grid"

interface AudioCellProps {
  readonly kind: "audio-cell"
  readonly url: string | null
  /**
   * Optional shortened display value that is drawn inside the cell.
   * We use this to avoid rendering (and measuring) very long strings like data URLs.
   */
  readonly displayValue?: string
}

// `tooltip` is an optional GridCell property used by our tooltip system
// (`columns/utils.hasTooltip`). Include it here so `cell.tooltip` is typed.
export type AudioCell = CustomCell<AudioCellProps> & {
  readonly tooltip?: string
}

const StyledAudio = styled.audio({
  maxWidth: "100%",
  width: "100%",
  maxHeight: "6rem",
})

const StyledLink = styled.a(({ theme }) => ({
  display: "inline-block",
  marginTop: theme.spacing.px,
  color: "inherit",
}))

export const AudioCellEditor: ProvideEditorComponent<AudioCell> = ({
  value,
}) => {
  const url = value.data.url ?? ""
  const isHttpLink = url.startsWith("http")

  return (
    <div>
      <StyledAudio controls src={url} data-testid="audio-element">
        <track kind="captions" />
      </StyledAudio>
      {isHttpLink ? (
        <StyledLink href={url} target="_blank" rel="noreferrer noopener">
          {url}
        </StyledLink>
      ) : null}
    </div>
  )
}

const renderer: CustomRenderer<AudioCell> = {
  kind: GridCellKind.Custom,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  isMatch: (c): c is AudioCell => (c.data as any).kind === "audio-cell",
  draw: (args, cell) => {
    const { url, displayValue } = cell.data
    drawTextCell(args, displayValue ?? url ?? "", cell.contentAlign)
    return true
  },
  measure: (ctx, cell, theme) => {
    const { url, displayValue } = cell.data
    const text = displayValue ?? url ?? ""
    return (
      (text ? ctx.measureText(text).width : 0) +
      theme.cellHorizontalPadding * 2
    )
  },
  provideEditor: () => ({
    editor: AudioCellEditor,
  }),
}

export default renderer
