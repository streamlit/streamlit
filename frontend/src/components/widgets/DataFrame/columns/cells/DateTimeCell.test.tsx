/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import React from "react"

import { fireEvent, render } from "@testing-library/react"

import { GridCellKind } from "@glideapps/glide-data-grid"
import {
  DateKind,
  DateTimeCell,
  formatValueForHTMLInput,
  DateTimeCellRenderer,
} from "./DateTimeCell"

const TEST_ID = "date-time-cell"

describe("formatValueForHTMLInput", () => {
  it.each([
    ["date", new Date("1970-01-01T00:00:00.100Z"), "1970-01-01"],
    [
      "datetime-local",
      new Date("1970-01-01T00:00:00.100Z"),
      "1970-01-01T00:00:00.100",
    ],
    ["time", new Date("1970-01-01T00:00:00.100Z"), "00:00:00.100"],
  ])(
    "check %p format and %p date leads correct format: {%p}",
    (format: string, date: Date, valueForHTML: string) => {
      expect(formatValueForHTMLInput(format as DateKind, date)).toStrictEqual(
        valueForHTML
      )
    }
  )
  it("throws an error when a weird value is passed", () => {
    expect(() =>
      formatValueForHTMLInput("weird" as DateKind, new Date())
    ).toThrow("Unknown date kind weird")
  })
})

describe("editor", () => {
  function getMockDateCell(props: Partial<DateTimeCell> = {}): DateTimeCell {
    return {
      ...props,
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "4",
      readonly: false,
      data: {
        kind: "date-time-cell",
        date: new Date("2023-02-06T04:47:44.584Z"),
        displayDate: new Date("2023-02-06T04:47:44.584Z").toISOString(),
        format: "time",
      },
    }
  }

  it("renders into the dom with correct value", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Editor = DateTimeCellRenderer.provideEditor(getMockDateCell()).editor
    if (Editor === undefined) {
      throw new Error("Editor is invalid")
    }

    const result = render(
      <Editor isHighlighted={false} value={getMockDateCell()} />
    )
    // Check if the element is actually there
    const input = result.getByTestId(TEST_ID)
    expect(input).not.toBeUndefined()

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(result.value === "04:47:44.584")
  })

  it.each([["date"], ["time"], ["datetime-local"]])(
    "renders with correct format",
    (format: string) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const Editor = DateTimeCellRenderer.provideEditor?.(
        getMockDateCell({ data: { format: format } } as DateTimeCell)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
      ).editor
      if (Editor === undefined) {
        throw new Error("Editor is invalid")
      }

      const result = render(
        <Editor isHighlighted={false} value={getMockDateCell()} />
      )
      const input = result.getByTestId(TEST_ID)
      expect(input).not.toBeUndefined()
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(input.format === format)
    }
  )

  it("renders textarea when readonly is true", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Editor = DateTimeCellRenderer.provideEditor?.(
      getMockDateCell({ readonly: true } as DateTimeCell)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    ).editor
    if (Editor === undefined) {
      throw new Error("Editor is invalid")
    }

    const result = render(
      <Editor isHighlighted={false} value={getMockDateCell()} />
    )
    // text-area should be found
    expect(
      result.findByDisplayValue("2023-02-06T04:47:44.584Z")
    ).not.toBeUndefined()
  })

  it("contains max, min, step when passed in", () => {
    const min = "2018-01-01"
    const max = "2018-12-31"
    const step = ".001"
    const extraProps = {
      data: {
        min,
        max,
        step,
      },
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Editor = DateTimeCellRenderer.provideEditor(
      getMockDateCell(extraProps as Partial<DateTimeCell>)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    ).editor
    if (Editor === undefined) {
      throw new Error("Editor is invalid")
    }

    const result = render(
      <Editor isHighlighted={false} value={getMockDateCell()} />
    )
    const input = result.getByTestId(TEST_ID)
    expect(input).not.toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(input.min === min)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(input.max === max)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(input.step === step)
  })

  it('properly sets date when value is NOT ""', async () => {
    const valueAsNumber = 100

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Editor = DateTimeCellRenderer.provideEditor(getMockDateCell()).editor
    if (Editor === undefined) {
      throw new Error("Editor is invalid")
    }

    const mockCellOnChange = jest.fn()
    const result = render(
      <Editor
        isHighlighted={false}
        value={getMockDateCell()}
        onChange={mockCellOnChange}
      />
    )
    const input = await result.findByTestId(TEST_ID)
    expect(result.findByTestId(TEST_ID)).not.toBeUndefined()
    fireEvent.change(input, {
      target: {
        value: "2023-02-06T18:15:33.103Z",
        valueAsNumber: valueAsNumber,
      },
    })
    expect(mockCellOnChange).toHaveBeenCalledTimes(1)
    expect(mockCellOnChange).toBeCalledWith({
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "4",
      readonly: false,
      data: {
        kind: "date-time-cell",
        date: new Date(valueAsNumber),
        displayDate: new Date("2023-02-06T04:47:44.584Z").toISOString(),
        format: "time",
      },
    })
  })

  it('properly sets new date to undefined when value is ""', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Editor = DateTimeCellRenderer.provideEditor(getMockDateCell()).editor
    if (Editor === undefined) {
      throw new Error("Editor is invalid")
    }

    const mockCellOnChange = jest.fn()
    const result = render(
      <Editor
        isHighlighted={false}
        value={getMockDateCell()}
        onChange={mockCellOnChange}
      />
    )
    const input = await result.findByTestId(TEST_ID)
    expect(result.findByTestId(TEST_ID)).not.toBeUndefined()
    fireEvent.change(input, { target: { value: "" } })
    expect(mockCellOnChange).toHaveBeenCalledTimes(1)
    expect(mockCellOnChange).toBeCalledWith({
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "4",
      readonly: false,
      data: {
        kind: "date-time-cell",
        // should be undefined since value is ''
        date: undefined,
        displayDate: new Date("2023-02-06T04:47:44.584Z").toISOString(),
        format: "time",
      },
    })
  })
})

describe("onPaste", () => {
  it.each([
    ["2023-02-06T04:47:44.584Z", "2023-02-06T04:47:44.584Z"],
    ["1995-12-17", "1995-12-17T00:00:00.000Z"],
    ["1995-12-17T03:24:00Z", "1995-12-17T03:24:00.000Z"],
    ["1995-12-17T03:24:00+00:00", "1995-12-17T03:24:00.000Z"],
    ["Sun Dec 17 1995 03:24:00 GMT", "1995-12-17T03:24:00.000Z"],
    ["100", "1970-01-01T00:00:00.100Z"],
    ["-1", "1969-12-31T23:59:59.999Z"],
  ])(
    "correctly interprets pasted value %p as %p",
    (input: string, expected: string) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { date } = DateTimeCellRenderer.onPaste(input, {})
      expect(date.toISOString()).toStrictEqual(expected)
    }
  )

  it.each([
    [""],
    ["invalid"],
    ["2020-20-12"],
    ["2020/20/12"],
    [undefined],
    [null],
    ["2020-12-10-10"],
  ])(
    "correctly returns no value when onPaste is called with invalid value: %p",
    (input: string | undefined | null) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { date } = DateTimeCellRenderer.onPaste(input, {})
      expect(date).toBe(undefined)
    }
  )

  it("support time strings in onPaste", () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { date } = DateTimeCellRenderer.onPaste("01:02:03.400", {
      format: "time",
    })
    expect(date).toStrictEqual(new Date("1970-01-01T01:02:03.400Z"))
  })
})
