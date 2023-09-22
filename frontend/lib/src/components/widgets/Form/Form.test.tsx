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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { ScriptRunState } from "@streamlit/lib/src/ScriptRunState"
import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { Form, Props } from "./Form"

describe("Form", () => {
  function getProps(props: Partial<Props> = {}): Props {
    return {
      formId: "mockFormId",
      width: 100,
      hasSubmitButton: false,
      scriptRunState: ScriptRunState.RUNNING,
      clearOnSubmit: false,
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: jest.fn(),
        formsDataChanged: jest.fn(),
      }),
      ...props,
    }
  }
  it("renders without crashing", () => {
    render(<Form {...getProps()} />)
    expect(screen.getByTestId("stForm")).toBeInTheDocument()
  })

  it("shows error if !hasSubmitButton && scriptRunState==NOT_RUNNING", () => {
    const props = getProps({
      hasSubmitButton: false,
      scriptRunState: ScriptRunState.RUNNING,
    })
    const { rerender } = render(<Form {...props} />)

    // We have no Submit Button, but the app is still running
    expect(screen.queryByTestId("stFormSubmitButton")).not.toBeInTheDocument()

    // When the app stops running, we show an error if the submit button
    // is still missing.
    rerender(
      <Form {...getProps({ scriptRunState: ScriptRunState.NOT_RUNNING })} />
    )
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // If the app restarts, we continue to show the error...
    rerender(
      <Form {...getProps({ scriptRunState: ScriptRunState.RUNNING })} />
    )
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // Until we get a submit button, and the error is removed immediately,
    // regardless of ScriptRunState.
    rerender(<Form {...getProps({ hasSubmitButton: true })} />)
    expect(screen.getByTestId("stForm")).toBeInTheDocument()
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()
  })
})
