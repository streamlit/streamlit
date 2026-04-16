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

import {
  type CustomCell,
  GridCellKind,
  type Item,
} from "@glideapps/glide-data-grid"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import renderer, {
  type MultiSelectCell,
  prepareOptions,
  resolveValues,
} from "./MultiSelectCell"

describe("prepareOptions", () => {
  const testCases = [
    {
      input: ["option1", "option2"],
      expected: [
        { value: "option1", label: "option1", color: undefined },
        { value: "option2", label: "option2", color: undefined },
      ],
    },
    {
      input: [{ value: "value1", label: "Label 1", color: "red" }],
      expected: [{ value: "value1", label: "Label 1", color: "red" }],
    },
    {
      input: ["option3", { value: "value2", color: "blue" }],
      expected: [
        { value: "option3", label: "option3", color: undefined },
        { value: "value2", label: "value2", color: "blue" },
      ],
    },
    {
      input: [null, { value: "value3" }],
      expected: [
        { value: "", label: "", color: undefined },
        { value: "value3", label: "value3", color: undefined },
      ],
    },
    {
      input: [],
      expected: [],
    },
    {
      input: [undefined, null],
      expected: [
        { value: "", label: "", color: undefined },
        { value: "", label: "", color: undefined },
      ],
    },
    {
      input: ["option4", null, { value: "value4" }, undefined],
      expected: [
        { value: "option4", label: "option4", color: undefined },
        { value: "", label: "", color: undefined },
        { value: "value4", label: "value4", color: undefined },
        { value: "", label: "", color: undefined },
      ],
    },
    {
      input: [{ value: "value5" }],
      expected: [{ value: "value5", label: "value5", color: undefined }],
    },
    {
      input: ["123", "456"],
      expected: [
        { value: "123", label: "123", color: undefined },
        { value: "456", label: "456", color: undefined },
      ],
    },
    {
      input: ["hello world", "special@char#"],
      expected: [
        { value: "hello world", label: "hello world", color: undefined },
        { value: "special@char#", label: "special@char#", color: undefined },
      ],
    },
  ]

  it.each(testCases)(
    "should correctly prepare options for react-select",
    testCase => {
      const result = prepareOptions(testCase.input)
      expect(result).toEqual(testCase.expected)
    }
  )
})

describe("resolveValues", () => {
  const options = [
    { value: "option1", label: "Option 1", color: "red" },
    { value: "option2", label: "Option 2", color: "blue" },
  ]

  const testCases = [
    // Empty values array
    {
      values: [],
      allowDuplicates: false,
      expected: [],
    },
    // Null values
    {
      values: null,
      allowDuplicates: false,
      expected: [],
    },
    // Undefined values
    {
      values: undefined,
      allowDuplicates: false,
      expected: [],
    },
    // Unique values without duplicates
    {
      values: ["option1", "nonExistingOption"],
      allowDuplicates: false,
      expected: [
        { value: "option1", label: "Option 1", color: "red" },
        { value: "nonExistingOption", label: "nonExistingOption" },
      ],
    },
    // Values with duplicates, allowDuplicates = false
    {
      values: ["option1", "option1", "nonExistingOption"],
      allowDuplicates: false,
      expected: [
        { value: "option1", label: "Option 1", color: "red" },
        { value: "option1", label: "Option 1", color: "red" },
        { value: "nonExistingOption", label: "nonExistingOption" },
      ],
    },
    // Values with duplicates, allowDuplicates = true
    {
      values: ["option1", "option1", "nonExistingOption"],
      allowDuplicates: true,
      expected: [
        { value: "__value0__option1", label: "Option 1", color: "red" },
        { value: "__value1__option1", label: "Option 1", color: "red" },
        { value: "__value2__nonExistingOption", label: "nonExistingOption" },
      ],
    },
  ]

  it.each(testCases)(
    "should resolve values correctly",
    ({ values, allowDuplicates, expected }) => {
      const result = resolveValues(values, options, allowDuplicates)
      expect(result).toEqual(expected)
    }
  )
})

describe("onPaste", () => {
  const options = [
    { value: "option1", label: "Option 1" },
    { value: "option2", color: "blue" },
    "option3",
  ]

  const testCases = [
    // Test case: Empty input string
    {
      input: "",
      cellProps: { kind: "multi-select-cell", values: [], options },
      expected: { kind: "multi-select-cell", options, values: [] },
    },
    // Test case: Input string with duplicates, allowDuplicates is false
    {
      input: "option1,option1,option2",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowDuplicates: false,
      },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["option1", "option2"],
        allowDuplicates: false,
      },
    },
    // Test case: Input string with values not in options, allowCreation is false
    {
      input: "option1,unknownOption",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowCreation: false,
      },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["option1"],
        allowCreation: false,
      },
    },
    // Test case: Input string with all values not in options, allowCreation is false
    {
      input: "unknownOption1,unknownOption2",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowCreation: false,
      },
      expected: undefined,
    },
    // Test case: Input with spaces around values
    {
      input: " option1 , option2 ",
      cellProps: { kind: "multi-select-cell", values: [], options },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["option1", "option2"],
      },
    },
    // Test case: Input with special characters
    {
      input: "special@char,option2",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowCreation: true,
      },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["special@char", "option2"],
        allowCreation: true,
      },
    },
    // Test case: Input string with duplicates, allowDuplicates is true
    {
      input: "option1,option1,option2",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowDuplicates: true,
      },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["option1", "option1", "option2"],
        allowDuplicates: true,
      },
    },
    // Test case: Input string with values not in options, allowCreation is true
    {
      input: "option1,unknownOption",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowCreation: true,
      },
      expected: {
        kind: "multi-select-cell",
        options,
        values: ["option1", "unknownOption"],
        allowCreation: true,
      },
    },
    // Test case: All values filtered out
    {
      input: "unknownOption1,unknownOption2",
      cellProps: {
        kind: "multi-select-cell",
        values: [],
        options,
        allowCreation: false,
      },
      expected: undefined,
    },
  ]

  testCases.forEach(({ input, cellProps, expected }) => {
    it(`should correctly handle pasting "${input}"`, () => {
      const result = renderer.onPaste?.(
        input,
        cellProps as MultiSelectCell["data"]
      )
      expect(result).toEqual(expected)
    })
  })
})

const keyDownEvent = {
  key: "ArrowDown",
}

// Using fireEvent instead of userEvent for react-select keyboard navigation
// because userEvent has compatibility issues with react-select's event handling
async function selectOption(
  container: HTMLElement,
  optionText: string
): Promise<void> {
  const inputElement = within(container).getByRole("combobox")
  // eslint-disable-next-line testing-library/prefer-user-event -- react-select requires fireEvent for keyboard navigation
  fireEvent.keyDown(inputElement, keyDownEvent)
  const listBox = within(container).getByRole("listbox")
  await within(listBox).findByText(optionText)
  // eslint-disable-next-line testing-library/prefer-user-event -- react-select requires fireEvent for click
  fireEvent.click(within(listBox).getByText(optionText))
}

function hasOption(container: HTMLElement, optionText: string): boolean {
  const inputElement = within(container).getByRole("combobox")
  // eslint-disable-next-line testing-library/prefer-user-event -- react-select requires fireEvent for keyboard navigation
  fireEvent.keyDown(inputElement, keyDownEvent)
  const listBox = within(container).getByRole("listbox")
  return within(listBox).queryByText(optionText) !== null
}

/** Helper to extract the editor component from provideEditor result. */
function getEditor(
  cell: MultiSelectCell
): React.FunctionComponent<Record<string, unknown>> {
  const result = renderer.provideEditor?.({
    ...cell,
    location: [0, 0] as Item,
  })
  if (result === undefined || !("editor" in result)) {
    throw new Error("provideEditor did not return an editor")
  }
  return result.editor as React.FunctionComponent<Record<string, unknown>>
}

describe("Multi Select Editor", () => {
  afterEach(cleanup)

  function getMockCell(
    props: Partial<Omit<MultiSelectCell, "data">> & {
      data?: Partial<MultiSelectCell["data"]>
    } = {}
  ): MultiSelectCell {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "option1",
      readonly: false,
      ...props,
      data: {
        kind: "multi-select-cell",
        options: [
          { value: "option1", label: "Option 1", color: "red" },
          { value: "option2", label: "Option 2", color: "blue" },
        ],
        values: [],
        ...props?.data,
      },
    }
  }

  it("renders into the dom with correct value", () => {
    const Editor = getEditor(getMockCell())

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={getMockCell()}
        onChange={mockCellOnChange}
      />
    )
    // Check if the element is actually there
    const cellEditor = screen.getByTestId("multi-select-cell")
    expect(cellEditor).toBeDefined()

    const input = cellEditor.getElementsByClassName("gdg-multi-select")[0]
    expect(input).toBeDefined()
  })

  it("allows to select values", async () => {
    const mockCell = getMockCell()
    const Editor = getEditor(mockCell)

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={mockCell}
        onChange={mockCellOnChange}
      />
    )
    // Check if the element is actually there
    const cellEditor = screen.getByTestId("multi-select-cell")
    expect(cellEditor).toBeDefined()

    await selectOption(cellEditor, "Option 1")
    expect(mockCellOnChange).toHaveBeenCalledTimes(1)
    expect(mockCellOnChange).toBeCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: ["option1"] },
    })

    expect(hasOption(cellEditor, "Option 2")).toBeTruthy()

    await selectOption(cellEditor, "Option 2")
    expect(mockCellOnChange).toHaveBeenCalledTimes(2)
    expect(mockCellOnChange).toBeCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: ["option1", "option2"] },
    })

    // Option 1 and 2 should not be available anymore
    expect(hasOption(cellEditor, "Option 1")).toBeFalsy()
    expect(hasOption(cellEditor, "Option 2")).toBeFalsy()
  })

  it("is disabled if readonly", () => {
    const mockCell = getMockCell({ readonly: true })
    const Editor = getEditor(mockCell)

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={mockCell}
        onChange={mockCellOnChange}
      />
    )
    // Check if the element is actually there
    const cellEditor = screen.getByTestId("multi-select-cell")
    expect(cellEditor).toBeDefined()
    // Combo box should not be accessible:
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  it("allowDuplicates allows to select values multiple times", async () => {
    const mockCell = getMockCell({ data: { allowDuplicates: true } })
    const Editor = getEditor(mockCell)

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={mockCell}
        onChange={mockCellOnChange}
      />
    )
    // Check if the element is actually there
    const cellEditor = screen.getByTestId("multi-select-cell")
    expect(cellEditor).toBeDefined()

    await selectOption(cellEditor, "Option 1")
    expect(mockCellOnChange).toHaveBeenCalledTimes(1)
    expect(mockCellOnChange).toBeCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: ["option1"] },
    })

    await selectOption(cellEditor, "Option 2")
    expect(mockCellOnChange).toHaveBeenCalledTimes(2)
    expect(mockCellOnChange).toBeCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: ["option1", "option2"] },
    })

    await selectOption(cellEditor, "Option 1")
    expect(mockCellOnChange).toHaveBeenCalledTimes(3)
    expect(mockCellOnChange).toBeCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: ["option1", "option2", "option1"] },
    })
  })

  it("allows text selection in pill labels (onMouseDown does not prevent default)", () => {
    const mockCell = getMockCell({
      data: {
        kind: "multi-select-cell",
        options: [
          { value: "option1", label: "Option 1", color: "red" },
          { value: "option2", label: "Option 2", color: "blue" },
        ],
        values: ["option1", "option2"],
      },
    })
    const Editor = getEditor(mockCell)

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={mockCell}
        onChange={mockCellOnChange}
      />
    )
    // Verify the component renders
    expect(screen.getByTestId("multi-select-cell")).toBeDefined()

    // Find the pill labels (MultiValueLabel components render with the label text)
    const pillLabel = screen.getByText("Option 1")
    expect(pillLabel).toBeDefined()

    // Simulate mousedown on the pill label - it should not prevent default (allowing text selection)
    // We verify this by checking that the event's defaultPrevented is false after the handler runs
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    })

    // The event should not be prevented (allowing text selection)
    pillLabel.dispatchEvent(mouseDownEvent)
    expect(mouseDownEvent.defaultPrevented).toBe(false)

    // The onChange should NOT have been called just from clicking the label
    // (stopPropagation prevents the control from receiving the click)
    expect(mockCellOnChange).not.toHaveBeenCalled()
  })

  it("still allows removing pills via the remove button after text selection enhancement", () => {
    const mockCell = getMockCell({
      data: {
        kind: "multi-select-cell",
        options: [
          { value: "option1", label: "Option 1", color: "red" },
          { value: "option2", label: "Option 2", color: "blue" },
        ],
        values: ["option1"],
      },
    })
    const Editor = getEditor(mockCell)

    const mockCellOnChange = vi.fn()
    render(
      <Editor
        isHighlighted={false}
        value={mockCell}
        onChange={mockCellOnChange}
      />
    )
    // Verify the component renders
    expect(screen.getByTestId("multi-select-cell")).toBeDefined()

    // Find the pill label first
    const pillLabel = screen.getByText("Option 1")
    expect(pillLabel).toBeDefined()

    // The remove button is a sibling of the label within the multi-value container
    // react-select renders: <div class="...multi-value"><div class="...label">text</div><div class="...remove">X</div></div>
    const multiValueContainer = pillLabel.parentElement
    expect(multiValueContainer).not.toBeNull()

    // Find the remove button (it's the element with the SVG/X icon, typically the last child or has a specific role)
    // react-select's remove button contains an SVG with a path
    const removeButton =
      multiValueContainer?.querySelector("svg")?.parentElement
    expect(removeButton).not.toBeNull()

    // Click the remove button - using fireEvent for react-select compatibility
    if (removeButton) {
      // eslint-disable-next-line testing-library/prefer-user-event -- react-select requires fireEvent for click
      fireEvent.click(removeButton)
    }

    // The onChange should have been called to remove the value
    expect(mockCellOnChange).toHaveBeenCalledTimes(1)
    expect(mockCellOnChange).toHaveBeenCalledWith({
      ...mockCell,
      data: { ...mockCell.data, values: [] },
    })
  })
})

describe("MultiSelectCell renderer", () => {
  /** The theme type expected by renderer.measure */
  type MeasureTheme = Parameters<NonNullable<typeof renderer.measure>>[2]

  const mockTheme = {
    cellHorizontalPadding: 8,
    bubblePadding: 4,
    bubbleMargin: 4,
  }

  it("correctly identifies multi-select cells", () => {
    const multiSelectCell = {
      kind: GridCellKind.Custom,
      data: {
        kind: "multi-select-cell",
        values: ["option1"],
        options: [{ value: "option1", label: "Option 1" }],
      },
      allowOverlay: true,
      copyData: "",
    } as CustomCell

    expect(renderer.isMatch(multiSelectCell)).toBe(true)
  })

  it("does not match non-multi-select cells", () => {
    const otherCell = {
      kind: GridCellKind.Custom,
      data: { kind: "other-cell" },
      allowOverlay: true,
      copyData: "",
    } as CustomCell

    expect(renderer.isMatch(otherCell)).toBe(false)
  })

  it("measures cell width correctly", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    const cell = {
      data: {
        kind: "multi-select-cell",
        values: ["option1", "option2"],
        options: [
          { value: "option1", label: "Option 1" },
          { value: "option2", label: "Option 2" },
        ],
      },
    } as unknown as MultiSelectCell

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- renderer.measure is defined for this cell type
    const width = renderer.measure!(ctx, cell, mockTheme as MeasureTheme)
    expect(width).toBeGreaterThan(0)
  })

  it("returns minimum width for empty values", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    const cell = {
      data: {
        kind: "multi-select-cell",
        values: [],
        options: [],
      },
    } as unknown as MultiSelectCell

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- renderer.measure is defined for this cell type
    const width = renderer.measure!(ctx, cell, mockTheme as MeasureTheme)
    expect(width).toBe(mockTheme.cellHorizontalPadding * 2)
  })

  it("returns minimum width for null values", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    const cell = {
      data: {
        kind: "multi-select-cell",
        values: null,
        options: [],
      },
    } as unknown as MultiSelectCell

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- renderer.measure is defined for this cell type
    const width = renderer.measure!(ctx, cell, mockTheme as MeasureTheme)
    expect(width).toBe(mockTheme.cellHorizontalPadding * 2)
  })
})
