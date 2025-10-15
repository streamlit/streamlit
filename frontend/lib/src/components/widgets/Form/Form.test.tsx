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

import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "~lib/WidgetStateManager"

import Form, { Props } from "./Form"

describe("Form", () => {
  function getProps(props: Partial<Props> = {}): Props {
    return {
      formId: "mockFormId",
      clearOnSubmit: false,
      enterToSubmit: true,
      widgetMgr: new WidgetStateManager({
        sendRerunBackMsg: vi.fn(),
        formsDataChanged: vi.fn(),
      }),
      border: false,
      ...props,
    }
  }

  const defaultFormsData = (
    formsDataOverrides: Partial<FormsData> = {}
  ): FormsData => {
    return {
      ...createFormsData(),
      ...formsDataOverrides,
    }
  }

  it("renders without crashing", () => {
    renderWithContexts(
      <Form {...getProps()} />,
      {},
      {
        formsData: defaultFormsData(),
      }
    )
    const formElement = screen.getByTestId("stForm")
    expect(formElement).toBeInTheDocument()
    expect(formElement).toHaveClass("stForm")
  })

  it("shows error if !hasSubmitButton && scriptRunState==NOT_RUNNING", () => {
    const formId = "mockFormId"
    const props = getProps({ formId })

    // Start with script RUNNING, no submit button
    const { rerenderWithContexts } = renderWithContexts(
      <Form {...props} />,
      {
        scriptRunState: ScriptRunState.RUNNING,
      },
      {
        // default formsData has no submit buttons
        formsData: defaultFormsData(),
      }
    )

    // We have no Submit Button, but the app is still running
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()

    // When the app stops running, we show an error if the submit button
    // is still missing.
    rerenderWithContexts(<Form {...props} />, {
      scriptRunState: ScriptRunState.NOT_RUNNING,
    })
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // If the app restarts, we continue to show the error...
    rerenderWithContexts(<Form {...props} />, {
      scriptRunState: ScriptRunState.RUNNING,
    })
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // Until we get a submit button, and the error is removed immediately,
    // regardless of ScriptRunState.
    const formsDataWithButton = createFormsData()
    formsDataWithButton.submitButtons.set(formId, [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock
      { formId } as any,
    ])
    rerenderWithContexts(<Form {...props} />, undefined, {
      formsData: formsDataWithButton,
    })
    expect(screen.getByTestId("stForm")).toBeInTheDocument()
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()
  })
})
