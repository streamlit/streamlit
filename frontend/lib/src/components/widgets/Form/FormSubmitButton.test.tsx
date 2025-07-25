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
import React from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { enableMapSet, enablePatches } from "immer"

import { Button as ButtonProto } from "@streamlit/protobuf"

import { renderWithContexts } from "~lib/test_util"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "~lib/WidgetStateManager"

import { FormSubmitButton, Props } from "./FormSubmitButton"

// Required by ImmerJS
enablePatches()
enableMapSet()

describe("FormSubmitButton", () => {
  let formsData: FormsData
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    formsData = createFormsData()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(newData => {
        formsData = newData
      }),
    })
  })

  function getProps(
    props: Partial<Props> = {},
    elementProps: Partial<ButtonProto> = {}
  ): Props {
    return {
      element: ButtonProto.create({
        id: "1",
        label: "Submit",
        formId: "mockFormId",
        help: "mockHelpText",
        useContainerWidth: false,
        ...elementProps,
      }),
      disabled: false,
      widgetMgr,
      ...props,
    }
  }

  it("renders without crashing", () => {
    // render with renderWithContexts necessary as FormsContext required
    // second arg is empty object as overrides for LibContextProps are not needed
    renderWithContexts(<FormSubmitButton {...getProps()} />, {})
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("has correct className", () => {
    const props = getProps()
    renderWithContexts(<FormSubmitButton {...props} />, {})

    const formSubmitButton = screen.getByTestId("stFormSubmitButton")

    expect(formSubmitButton).toHaveClass("stFormSubmitButton")
  })

  it("renders a label within the button", () => {
    const props = getProps()
    renderWithContexts(<FormSubmitButton {...props} />, {})

    const formSubmitButton = screen.getByRole("button", {
      name: `${props.element.label}`,
    })

    expect(formSubmitButton).toBeInTheDocument()
  })

  it("renders with help properly", async () => {
    const user = userEvent.setup()
    renderWithContexts(
      <FormSubmitButton {...getProps({}, { help: "mockHelpText" })} />,
      {}
    )

    // Ensure both the button and the tooltip target have the correct width.
    // These will be 100% and the ElementContainer will have styles to determine
    // the button width.
    const formSubmitButton = screen.getByRole("button")
    expect(formSubmitButton).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("calls submitForm when clicked", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "submitForm")
    renderWithContexts(<FormSubmitButton {...props} />, {})

    const formSubmitButton = screen.getByRole("button")

    await user.click(formSubmitButton)
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(
      props.element.formId,
      undefined,
      props.element
    )
  })

  it("can pass fragmentId to submitForm", async () => {
    const user = userEvent.setup()
    const props = getProps({ fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "submitForm")
    renderWithContexts(<FormSubmitButton {...props} />, {})

    const formSubmitButton = screen.getByRole("button")

    await user.click(formSubmitButton)
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(
      props.element.formId,
      "myFragmentId",
      props.element
    )
  })

  it("is disabled when form has pending upload", () => {
    // Override the formsData to include the form in the formsWithUploads set
    const formsDataOverride = {
      ...createFormsData(),
      formsWithUploads: new Set(["mockFormId"]),
    }

    renderWithContexts(
      <FormSubmitButton {...getProps()} />,
      {},
      {
        formsData: formsDataOverride,
      }
    )

    const formSubmitButton = screen.getByRole("button")
    expect(formSubmitButton).toBeDisabled()
  })

  it("Adds the proto to submitButtons on mount and removes the proto on unmount", () => {
    expect(formsData.submitButtons.get("mockFormId")).toBeUndefined()

    const props = getProps()
    const props2 = getProps({
      element: ButtonProto.create({
        id: "2",
        label: "Submit",
        formId: "mockFormId",
        help: "mockHelpText",
      }),
    })

    const { unmount: unmountView1 } = renderWithContexts(
      <FormSubmitButton {...props} />,
      {}
    )

    expect(formsData.submitButtons.get("mockFormId")?.length).toBe(1)
    // @ts-expect-error
    expect(formsData.submitButtons.get("mockFormId")[0]).toEqual(props.element)

    const { unmount: unmountView2 } = renderWithContexts(
      <FormSubmitButton {...props2} />,
      {}
    )

    expect(formsData.submitButtons.get("mockFormId")?.length).toBe(2)
    // @ts-expect-error
    expect(formsData.submitButtons.get("mockFormId")[1]).toEqual(
      props2.element
    )

    unmountView1()

    expect(formsData.submitButtons.get("mockFormId")?.length).toBe(1)
    // @ts-expect-error
    expect(formsData.submitButtons.get("mockFormId")[0]).toEqual(
      props2.element
    )

    unmountView2()

    expect(formsData.submitButtons.get("mockFormId")?.length).toBe(0)
  })
})
