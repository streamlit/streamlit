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

import type { ComponentProps } from "react"

import { GridCellKind, type Theme } from "@glideapps/glide-data-grid"
import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import { AudioCellEditor } from "./AudioCell"
import type { AudioCell } from "./AudioCell"

type EditorProps = ComponentProps<typeof AudioCellEditor>

const createCell = (url: string | null): AudioCell => ({
  kind: GridCellKind.Custom,
  data: { kind: "audio-cell", url },
  copyData: url ?? "",
  allowOverlay: true,
})

const createEditorProps = (url: string | null): EditorProps => ({
  value: createCell(url),
  onChange: () => {},
  onFinishedEditing: () => {},
  isHighlighted: false,
  target: { x: 0, y: 0, width: 0, height: 0 },
  forceEditMode: false,
  theme: {} as Theme,
})

describe("AudioCellEditor", () => {
  it("renders an audio element with the correct src", () => {
    render(
      <AudioCellEditor {...createEditorProps("https://example.com/a.mp3")} />
    )

    const audioElement = screen.getByTestId("audio-element")
    expect(audioElement).toHaveAttribute("src", "https://example.com/a.mp3")
  })

  it("renders a link for http(s) sources", () => {
    render(
      <AudioCellEditor {...createEditorProps("https://example.com/a.mp3")} />
    )

    const linkElement = screen.getByRole("link")
    expect(linkElement).toHaveAttribute("href", "https://example.com/a.mp3")
    expect(linkElement).toHaveAttribute("target", "_blank")
    expect(linkElement).toHaveAttribute("rel", "noreferrer noopener")
  })

  it("does not render a link for non-http sources", () => {
    render(<AudioCellEditor {...createEditorProps("/local/audio.mp3")} />)

    expect(screen.queryByRole("link")).toBeNull()
  })

  it("renders an empty audio element when url is missing", () => {
    render(<AudioCellEditor {...createEditorProps(null)} />)

    const audioElement = screen.getByTestId("audio-element")
    expect(audioElement).toHaveAttribute("src", "")
  })
})
