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
import { MultiSelectCellType } from "@glideapps/glide-data-grid-cells"
import { Field, List, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { mockTheme } from "~lib/mocks/mockTheme"
import { blend, getMarkdownBgColors } from "~lib/theme"

import MultiselectColumn, {
  type MultiselectColumnParams,
  prepareOptions,
} from "./MultiselectColumn"
import { BaseColumnProps, isErrorCell, isMissingValueCell } from "./utils"

const MOCK_MULTISELECT_COLUMN_PROPS: BaseColumnProps = {
  id: "1",
  name: "multiselect_column",
  title: "Multi-select column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field(
      "multiselect_column",
      new List(new Field("item", new Utf8(), true)),
      true
    ),
    pandasType: {
      field_name: "multiselect_column",
      name: "multiselect_column",
      pandas_type: "object",
      numpy_type: "list[unicode]",
      metadata: null,
    },
  },
}

function getMultiselectColumn(
  params?: MultiselectColumnParams,
  columnPropsOverwrite?: Partial<BaseColumnProps>
): ReturnType<typeof MultiselectColumn> {
  return MultiselectColumn(
    {
      ...MOCK_MULTISELECT_COLUMN_PROPS,
      ...columnPropsOverwrite,
      columnTypeOptions: params,
    } as BaseColumnProps,
    mockTheme.emotion
  )
}

describe("MultiselectColumn", () => {
  it("creates a valid column instance with string options", () => {
    const options = ["foo", "bar"]
    const mockColumn = getMultiselectColumn({ options })
    expect(mockColumn.kind).toEqual("multiselect")
    expect(mockColumn.title).toEqual(MOCK_MULTISELECT_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_MULTISELECT_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(["foo"])
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual(["foo"]) // returns values

    const expectedOptions = prepareOptions(options, mockTheme.emotion)
    expect((mockCell as MultiSelectCellType).data.options).toEqual(
      expectedOptions
    )
    expect((mockCell as MultiSelectCellType).data.allowCreation).toEqual(false)
    expect((mockCell as MultiSelectCellType).data.allowDuplicates).toEqual(
      false
    )
  })

  it("uses faded style for index columns", () => {
    const mockColumn = getMultiselectColumn(
      { options: ["foo"] },
      { isIndex: true }
    )
    const mockCell = mockColumn.getCell(["foo"]) as MultiSelectCellType
    expect(mockCell.style).toEqual("faded")
  })

  it("respects accept_new_options config for creation", () => {
    const mockColumn = getMultiselectColumn({
      options: ["foo", "bar"],
      accept_new_options: true,
    })
    const mockCell = mockColumn.getCell(["foo"]) as MultiSelectCellType
    expect(mockCell.data.allowCreation).toEqual(true)
    expect(mockCell.data.allowDuplicates).toEqual(false)
  })

  it("validates values against options when accept_new_options is false", () => {
    const mockColumn = getMultiselectColumn({ options: ["A", "B"] })
    const validatedCell = mockColumn.getCell(["A", "C"], true)
    expect(isErrorCell(validatedCell)).toEqual(false)
    expect((validatedCell as MultiSelectCellType).data.values).toEqual(["A"]) // filtered
  })

  it("creates error cell if values are not in options when validating", () => {
    const mockColumn = getMultiselectColumn({ options: ["A", "B"] })
    const errorCell = mockColumn.getCell(["Z"], true)
    expect(isErrorCell(errorCell)).toEqual(true)
  })

  it.each([[null], [undefined]])(
    "%p is interpreted as missing value",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting for test inputs only
    (input: any) => {
      const mockColumn = getMultiselectColumn({ options: ["foo", "bar"] })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(null)
      expect(isMissingValueCell(mockCell)).toEqual(true)
    }
  )

  it('"" (empty string) is interpreted as empty array, not missing', () => {
    const mockColumn = getMultiselectColumn({ options: ["foo", "bar"] })
    const mockCell = mockColumn.getCell("")
    expect(mockColumn.getCellValue(mockCell)).toEqual([])
    expect(isMissingValueCell(mockCell)).toEqual(false)
  })

  it("marks non-string array values as non-editable error when editing", () => {
    const mockColumn = getMultiselectColumn(
      { options: ["x"] },
      {
        isEditable: true,
      }
    )
    const cell = mockColumn.getCell([1, "x"]) as MultiSelectCellType
    // Should mark as error and readonly due to non-string values
    expect((cell as unknown as { readonly?: boolean }).readonly).toEqual(true)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it.each([
    [["a", "b"], "a,b"],
    [["a,b", "c"], "a b,c"],
    [[], ""],
  ])(
    "correctly prepares data for copy (%p -> %p)",
    (input: string[], expectedCopy: string) => {
      const mockColumn = getMultiselectColumn({ options: ["a", "b", "c"] })
      const cell = mockColumn.getCell(input) as MultiSelectCellType
      expect(cell.copyData).toEqual(expectedCopy)
    }
  )
})

describe("prepareOptions", () => {
  it.each([
    [
      ["foo", "bar"],
      [
        { value: "foo", label: undefined, color: undefined },
        { value: "bar", label: undefined, color: undefined },
      ],
    ],
    [
      [
        { value: "us", label: "United States" },
        { value: "de", label: "Germany" },
      ],
      [
        { value: "us", label: "United States", color: undefined },
        { value: "de", label: "Germany", color: undefined },
      ],
    ],
    [
      // Filters out empty string and null entries
      ["", "A", null, "B"] as unknown as (string | { value: string })[],
      [
        { value: "A", label: undefined, color: undefined },
        { value: "B", label: undefined, color: undefined },
      ],
    ],
    [
      // Trims whitespace around values
      ["  foo  ", "bar "],
      [
        { value: "foo", label: undefined, color: undefined },
        { value: "bar", label: undefined, color: undefined },
      ],
    ],
  ])("normalizes %j into %j", (input, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting for test inputs only
    expect(prepareOptions(input as any, mockTheme.emotion)).toEqual(expected)
  })

  it("applies theme color mapping and blends for named colors", () => {
    const namedColorOption = [
      { value: "prio", label: "Priority", color: "red" },
    ]
    const opts = prepareOptions(namedColorOption, mockTheme.emotion)
    const mdColors = getMarkdownBgColors(mockTheme.emotion)
    const expected = blend(mdColors.redbg, mockTheme.emotion.colors.bgColor)
    expect(opts[0].color).toEqual(expected)
  })

  it("blends custom color with theme background when color is not mapped", () => {
    const customColor = "#008000"
    const opts = prepareOptions(
      [{ value: "ok", color: customColor }],
      mockTheme.emotion
    )
    const expected = blend(customColor, mockTheme.emotion.colors.bgColor)
    expect(opts[0].color).toEqual(expected)
  })
})
