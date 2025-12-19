/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import AudioColumn from "./AudioColumn"
import type { AudioCell } from "./cells/AudioCell"

const MOCK_AUDIO_COLUMN_PROPS = {
  id: "1",
  name: "audio_column",
  title: "Audio column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("audio_column", new Utf8(), true),
    pandasType: {
      field_name: "audio_column",
      name: "audio_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("AudioColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = AudioColumn(MOCK_AUDIO_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("audio")
    expect(mockColumn.title).toEqual(MOCK_AUDIO_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_AUDIO_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(
      "https://example.com/audio.mp3"
    ) as AudioCell
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockCell.contentAlign).toEqual("center")
    expect(mockCell.data.url).toEqual("https://example.com/audio.mp3")
    expect(mockCell.data.displayValue).toEqual("Audio: example.com/audio.mp3")
    expect(mockCell.tooltip).toContain("Double-click to open the player.")
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = AudioColumn({
      ...MOCK_AUDIO_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
  })

  it.each([
    ["https://example.com/audio.mp3", "https://example.com/audio.mp3"],
    ["/foo/bar.mp3", "/foo/bar.mp3"],
    ["", ""],
    [[], ""],
    ["data:audio/mpeg;base64,aGVsbG8=", "data:audio/mpeg;base64,aGVsbG8="],
    [null, null],
    [undefined, null],
  ])(
    "supports string-compatible value (%p parsed as %p)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (input: any, value: string | null) => {
      const mockColumn = AudioColumn(MOCK_AUDIO_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("uses a short display value and does not include the full data URL in the tooltip", () => {
    const mockColumn = AudioColumn(MOCK_AUDIO_COLUMN_PROPS)
    const dataUrl = `data:audio/mpeg;base64,${"a".repeat(1000)}`
    const cell = mockColumn.getCell(dataUrl) as AudioCell

    expect(cell.data.displayValue).toEqual("Audio: data URL")
    expect(cell.tooltip).toContain("Audio data URL")
    expect(cell.tooltip).not.toContain("a".repeat(200))
  })
})
