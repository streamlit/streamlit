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

import { screen } from "@testing-library/react"

import { JsonEditor as JsonEditorProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import JsonEditor, { Props } from "./JsonEditor"

const getProps = (
  elementProps: Partial<JsonEditorProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: JsonEditorProto.create({
    id: "1",
    default: '{"key": "value", "number": 42}',
    inputType: "dict",
    disabled: false,
    height: 0,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("JsonEditor widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<JsonEditor {...props} />)
    const jsonEditor = screen.getByTestId("stJsonEditor")
    expect(jsonEditor).toBeInTheDocument()
    expect(jsonEditor).toHaveClass("stJsonEditor")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<JsonEditor {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<JsonEditor {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("displays JSON content correctly", () => {
    const props = getProps()
    render(<JsonEditor {...props} />)

    // The JSON keys should be visible somewhere in the component
    const jsonEditor = screen.getByTestId("stJsonEditor")
    expect(jsonEditor.textContent).toContain("key")
    expect(jsonEditor.textContent).toContain("number")
  })

  it("shows error for invalid JSON", () => {
    const props = getProps({ default: "invalid json" })
    render(<JsonEditor {...props} />)

    // Should show an error element
    expect(screen.getByText(/Json Parse Error/)).toBeVisible()
  })

  it("renders with custom height", () => {
    const props = getProps({ height: 300 })
    render(<JsonEditor {...props} />)

    const jsonEditor = screen.getByTestId("stJsonEditor")
    expect(jsonEditor).toHaveStyle({ height: "300px" })
  })

  it.each([
    ["{}", "dict", "empty object"],
    ['[1, 2, 3, "four"]', "list", "array"],
    [
      '{"level1": {"level2": {"innerValue": "deep"}}}',
      "dict",
      "nested structure",
    ],
  ])(
    "renders %s as %s correctly",
    (defaultValue: string, inputType: string) => {
      const props = getProps({ default: defaultValue, inputType })
      render(<JsonEditor {...props} />)

      expect(screen.getByTestId("stJsonEditor")).toBeVisible()
    }
  )
})
