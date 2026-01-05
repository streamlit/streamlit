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

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { GridCellKind, UriCell } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import LinkColumn from "./LinkColumn"
import { ErrorCell, isErrorCell } from "./utils"

const MOCK_LINK_COLUMN_PROPS = {
  id: "1",
  name: "link_column",
  title: "Link column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("link_column", new Utf8(), true),
    pandasType: {
      field_name: "link_column",
      name: "link_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("LinkColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("link")
    expect(mockColumn.title).toEqual(MOCK_LINK_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_LINK_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("https://streamlit.io") as UriCell
    expect(mockCell.kind).toEqual(GridCellKind.Uri)
    expect(mockCell.data).toEqual("https://streamlit.io")
    expect(mockCell.displayData).toEqual("https://streamlit.io")
  })

  it.each([
    ["foo", "foo"],
    ["https://streamlit.io", "https://streamlit.io"],
    ["/path/to/file", "/path/to/file"],
    [null, null],
    [undefined, null],
    // All the values that are supported by the TextColumn
    // should also be supported by the UrlColumn.
  ])(
    "supports string-compatible value (%p parsed as %p)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents -- TODO: Replace 'any' with a more specific type.
    (input: any, value: any | null) => {
      const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("validates input based on max_chars", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5 },
    })

    expect(mockColumn.validateInput!("12345")).toBe(true)
    expect(mockColumn.validateInput!("123456")).toBe(false)
    expect(mockColumn.validateInput!("1234567890")).toBe(false)
  })

  it("validates input based on validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: {
        validate:
          "^https://(?:www.)?(?:[a-zA-Z0-9-]+.)*streamlit.app(?:/.*)?$",
      },
    })

    expect(mockColumn.validateInput!("https://issues.streamlit.app/")).toBe(
      true
    )
    expect(
      mockColumn.validateInput!(
        "https://issues.streamlit.app/Streamlit_Issues_Leaderboard?issue=10"
      )
    ).toBe(true)
    expect(mockColumn.validateInput!("issues.streamlit.app/")).toBe(false)
    expect(mockColumn.validateInput!("https://issues.streamlit.io/")).toBe(
      false
    )
  })

  it("applies input validation in the getCell call based on max_chars and validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: {
        max_chars: 40,
        validate:
          "^https://(?:www.)?(?:[a-zA-Z0-9-]+.)*streamlit.app(?:/.*)?$",
      },
    })

    expect(
      isErrorCell(mockColumn.getCell("https://issues.streamlit.app/", true))
    ).toBe(false)
    expect(
      isErrorCell(mockColumn.getCell("https://issues.streamlit.io/", true))
    ).toBe(true)

    // We do not auto fix a link cell that's too long
    expect(
      isErrorCell(
        mockColumn.getCell(
          "https://issues.streamlit.app/Streamlit_Issues_Leaderboard?issue=10",
          true
        )
      )
    ).toBe(true)
  })

  it("handles invalid validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { validate: "[" }, // Invalid regex
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(true)
    expect((cell as ErrorCell).data).toContain("test")
    expect((cell as ErrorCell).errorDetails).toContain(
      "Invalid validate regex"
    )
  })

  it("ignores empty validate", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { validate: "" },
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(false)
  })

  it("sets the href and displayText values correctly", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: "Click me" },
    })

    const cell = mockColumn.getCell("https://streamlit.io", true) as UriCell

    const cellValue = mockColumn.getCellValue(cell)
    expect(cellValue).toBe("https://streamlit.io")
    expect(cell.displayData).toBe("Click me")
  })

  it("sets displayed value to be the href when displayText is empty", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: undefined },
    })

    const cell = mockColumn.getCell("https://streamlit.io", true) as UriCell

    expect(cell.displayData).toBe("https://streamlit.io")
  })

  it("sets displayed value to be displayText when displayText is defined and not a regexp", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: "streamlit" },
    })

    const cell = mockColumn.getCell("https://streamlit.io", true) as UriCell

    expect(cell.displayData).toBe("streamlit")
  })

  it("sets displayed value as the applied regex to the href when displayText is a regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: "https://(.*?).streamlit.app" },
    })

    const cell = mockColumn.getCell(
      "https://roadmap.streamlit.app",
      true
    ) as UriCell

    expect(cell.displayData).toBe("roadmap")
  })

  it("sets displayed value as the applied regex to the href when displayText is a regex with URL encoding", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: {
        display_text: "https://streamlit\\.app\\?app=(.*)",
      },
    })

    const cell = mockColumn.getCell(
      "https://streamlit.app?app=foo%20app%20%25",
      true
    ) as UriCell

    expect(cell.displayData).toBe("foo app %")
  })

  it("sets displayed value as the href, when displayText is a regex but there is no match", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: "https://(.*?)\\.google.com" },
    })

    const cell = mockColumn.getCell(
      "https://roadmap.streamlit.app",
      true
    ) as UriCell

    expect(cell.displayData).toBe("https://roadmap.streamlit.app")
  })

  it("displays material icon when display_text is a material icon", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: ":material/open_in_new:" },
    })

    const cell = mockColumn.getCell("https://streamlit.io", true) as UriCell

    // The display should be the icon name for the icon font
    expect(cell.displayData).toBe("open_in_new")
    // Should center align when using icon
    expect(cell.contentAlign).toBe("center")
    // Should have theme override for icon font
    expect(cell.themeOverride).toBeDefined()
  })

  it("does not allow overlay when using material icon display", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { display_text: ":material/link:" },
    })

    const cell = mockColumn.getCell("https://streamlit.io", true) as UriCell

    expect(cell.allowOverlay).toBe(false)
  })

  it("returns false for validateInput when value is null and column is required", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      isRequired: true,
    })

    expect(mockColumn.validateInput!(null)).toBe(false)
    expect(mockColumn.validateInput!(undefined)).toBe(false)
  })

  it("returns true for validateInput when value is null and column is not required", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)

    expect(mockColumn.validateInput!(null)).toBe(true)
    expect(mockColumn.validateInput!(undefined)).toBe(true)
  })

  it("returns null for getCellValue when cell data is null", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell(null) as UriCell

    expect(mockColumn.getCellValue(cell)).toBeNull()
  })

  it("creates a missing value cell for null data", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell(null) as UriCell

    expect(cell.data).toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    expect((cell as any).isMissingValue).toBe(true)
  })

  it("opens link in new tab with correct parameters", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell("https://streamlit.io") as UriCell

    const mockOpen = vi.spyOn(window, "open").mockImplementation(() => null)
    const mockPreventDefault = vi.fn()

    cell.onClickUri?.({ preventDefault: mockPreventDefault } as never)

    expect(mockOpen).toHaveBeenCalledWith(
      "https://streamlit.io",
      "_blank",
      "noopener,noreferrer"
    )
    expect(mockPreventDefault).toHaveBeenCalled()

    mockOpen.mockRestore()
  })

  it("prepends https:// for www. links", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell("www.streamlit.io") as UriCell

    const mockOpen = vi.spyOn(window, "open").mockImplementation(() => null)

    cell.onClickUri?.({ preventDefault: vi.fn() } as never)

    expect(mockOpen).toHaveBeenCalledWith(
      "https://www.streamlit.io",
      "_blank",
      "noopener,noreferrer"
    )

    mockOpen.mockRestore()
  })

  it("has correct typeIcon", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    expect(mockColumn.typeIcon).toBe(":material/link:")
  })

  it("has correct sortMode", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    expect(mockColumn.sortMode).toBe("default")
  })

  it("sets correct copyData", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell("https://streamlit.io") as UriCell

    expect(cell.copyData).toBe("https://streamlit.io")
  })

  it("handles empty href correctly", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    const cell = mockColumn.getCell("") as UriCell

    // Empty string should be treated similar to null for display
    expect(cell.displayData).toBe("")
  })
})
