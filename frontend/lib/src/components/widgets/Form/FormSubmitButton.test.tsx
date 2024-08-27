/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"
import { enableAllPlugins } from "immer"

import { render } from "@streamlit/lib/src/test_util"
import { Button as ButtonProto } from "@streamlit/lib/src/proto"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"

import { FormSubmitButton, Props } from "./FormSubmitButton"

// Required by ImmerJS
enableAllPlugins()

describe("FormSubmitButton", () => {
  let formsData: FormsData
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    formsData = createFormsData()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(newData => {
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
      hasInProgressUpload: false,
      width: 250,
      widgetMgr,
      ...props,
    }
  }

  it("renders without crashing", () => {
    render(<FormSubmitButton {...getProps()} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<FormSubmitButton {...props} />)

    const formSubmitButton = screen.getByTestId("stFormSubmitButton")

    expect(formSubmitButton).toHaveClass("stFormSubmitButton")
    expect(formSubmitButton).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label", () => {
    const props = getProps()
    render(<FormSubmitButton {...props} />)

    const formSubmitButton = screen.getByRole("button", {
      name: `${props.element.label}`,
    })

    expect(formSubmitButton).toBeInTheDocument()
  })

  it("calls submitForm when clicked", async () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "submitForm")
    render(<FormSubmitButton {...props} />)

    const formSubmitButton = screen.getByRole("button")

    fireEvent.click(formSubmitButton)
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(
      props.element.formId,
      undefined,
      props.element
    )
  })

  it("can pass fragmentId to submitForm", async () => {
    const props = getProps({ fragmentId: "myFragmentId" })
    jest.spyOn(props.widgetMgr, "submitForm")
    render(<FormSubmitButton {...props} />)

    const formSubmitButton = screen.getByRole("button")

    fireEvent.click(formSubmitButton)
    expect(props.widgetMgr.submitForm).toHaveBeenCalledWith(
      props.element.formId,
      "myFragmentId",
      props.element
    )
  })

  it("is disabled when form has pending upload", () => {
    const props = getProps({ hasInProgressUpload: true })
    render(<FormSubmitButton {...props} />)

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

    const { unmount: unmountView1 } = render(<FormSubmitButton {...props} />)

    expect(formsData.submitButtons.get("mockFormId")?.length).toBe(1)
    // @ts-expect-error
    expect(formsData.submitButtons.get("mockFormId")[0]).toEqual(props.element)

    const { unmount: unmountView2 } = render(<FormSubmitButton {...props2} />)

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

  it("does not use container width by default", () => {
    render(<FormSubmitButton {...getProps()} />)

    const formSubmitButton = screen.getByRole("button")
    expect(formSubmitButton).toHaveStyle("width: auto")
  })

  it("passes useContainerWidth property with help correctly", () => {
    render(<FormSubmitButton {...getProps({}, { useContainerWidth: true })} />)

    const formSubmitButton = screen.getByRole("button")
    expect(formSubmitButton).toHaveStyle(`width: ${250}px`)
  })

  it("passes useContainerWidth property without help correctly", () => {
    render(
      <FormSubmitButton
        {...getProps({}, { useContainerWidth: true, help: "" })}
      />
    )

    const formSubmitButton = screen.getByRole("button")
    expect(formSubmitButton).toHaveStyle("width: 100%")
  })

  it("renders an emoji icon", () => {
    render(<FormSubmitButton {...getProps({}, { icon: "😀", help: "" })} />)

    const icon = screen.getByTestId("stIconEmoji")
    expect(icon).toHaveTextContent("😀")
  })

  it("renders a material icon", () => {
    render(
      <FormSubmitButton
        {...getProps({}, { icon: ":material/thumb_up:", help: "" })}
      />
    )

    const icon = screen.getByTestId("stIconMaterial")
    expect(icon).toHaveTextContent("thumb_up")
  })
})
