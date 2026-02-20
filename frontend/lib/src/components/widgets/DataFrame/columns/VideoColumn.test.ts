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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import { VideoCell } from "./cells/VideoCell"
import VideoColumn from "./VideoColumn"

const MOCK_VIDEO_COLUMN_PROPS = {
  id: "1",
  name: "video_column",
  title: "Video column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("video_column", new Utf8(), true),
    pandasType: {
      field_name: "video_column",
      name: "video_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("VideoColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = VideoColumn(MOCK_VIDEO_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("video")
    expect(mockColumn.title).toEqual(MOCK_VIDEO_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_VIDEO_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("https://example.com/video.mp4")
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockCell.contentAlign).toEqual("center")
    expect((mockCell as VideoCell).data.src).toEqual(
      "https://example.com/video.mp4"
    )
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = VideoColumn({
      ...MOCK_VIDEO_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
  })

  it.each([
    // Video column supports URL and data URI values:
    ["https://example.com/video.mp4", "https://example.com/video.mp4"],
    ["/app/static/video.mp4", "/app/static/video.mp4"],
    ["", ""],
    [[], ""],
    [
      "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
      "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
    ],
    [null, null],
    [undefined, null],
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: unknown, value: string | null) => {
      const mockColumn = VideoColumn(MOCK_VIDEO_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )
})
