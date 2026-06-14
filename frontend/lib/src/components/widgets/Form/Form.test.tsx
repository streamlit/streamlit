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

import { Button as SubmitButtonProto } from "@streamlit/protobuf"

import { INITIAL_SCRIPT_RUN_ID } from "~lib/components/core/ScriptRunContext"
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
    renderWithContexts(<Form {...getProps()} />, {
      formsContext: {
        formsData: defaultFormsData(),
      },
    })
    const formElement = screen.getByTestId("stForm")
    expect(formElement).toBeInTheDocument()
    expect(formElement).toHaveClass("stForm")
  })

  it("does not show missing submit button error during initial app load", () => {
    const { rerenderWithContexts } = renderWithContexts(
      <Form {...getProps()} />,
      {
        formsContext: {
          formsData: defaultFormsData(),
        },
        scriptRunContext: {
          scriptRunId: INITIAL_SCRIPT_RUN_ID,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        },
      }
    )

    // During the initial app load (before the first script run), the warning
    // must not flash even though the script is NOT_RUNNING.
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()

    // Once a real script run has finished, the warning should appear for a
    // form that is still missing a submit button.
    rerenderWithContexts(<Form {...getProps()} />, {
      scriptRunContext: {
        scriptRunId: "script run 123",
        scriptRunState: ScriptRunState.NOT_RUNNING,
      },
    })
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()
  })

  it("shows error if !hasSubmitButton && scriptRunState==NOT_RUNNING", () => {
    const formId = "mockFormId"
    const props = getProps({ formId })

    // Start with script RUNNING, no submit button
    const { rerenderWithContexts } = renderWithContexts(<Form {...props} />, {
      formsContext: {
        // default formsData has no submit buttons
        formsData: defaultFormsData(),
      },
      scriptRunContext: {
        scriptRunState: ScriptRunState.RUNNING,
      },
    })

    // We have no Submit Button, but the app is still running
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()

    // When the app stops running, we show an error if the submit button
    // is still missing.
    rerenderWithContexts(<Form {...props} />, {
      scriptRunContext: {
        scriptRunState: ScriptRunState.NOT_RUNNING,
      },
    })
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // If the app restarts, we continue to show the error...
    rerenderWithContexts(<Form {...props} />, {
      scriptRunContext: {
        scriptRunState: ScriptRunState.RUNNING,
      },
    })
    expect(screen.getByText("Missing Submit Button")).toBeInTheDocument()

    // Until we get a submit button, and the error is removed immediately,
    // regardless of ScriptRunState.
    const formsDataWithButton = createFormsData()
    formsDataWithButton.submitButtons.set(formId, [
      { formId } as SubmitButtonProto,
    ])
    rerenderWithContexts(<Form {...props} />, {
      formsContext: {
        formsData: formsDataWithButton,
      },
    })
    expect(screen.getByTestId("stForm")).toBeInTheDocument()
    expect(screen.queryByText("Missing Submit Button")).not.toBeInTheDocument()
  })
})
