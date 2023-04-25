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
import { Kind } from "src/lib/components/shared/AlertContainer"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { shallow } from "src/lib/test_util"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
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

  it("shows error if !hasSubmitButton && scriptRunState==NOT_RUNNING", () => {
    const props = getProps({
      hasSubmitButton: false,
      scriptRunState: ScriptRunState.RUNNING,
    })
    const wrapper = shallow(<Form {...props} />)

    // We have no Submit Button, but the app is still running
    expect(wrapper.find("Alert").exists()).toBeFalsy()

    // When the app stops running, we show an error if the submit button
    // is still missing.
    wrapper.setProps({ scriptRunState: ScriptRunState.NOT_RUNNING })

    expect(wrapper.find("Alert").exists()).toBeTruthy()
    expect(wrapper.find("Alert").prop("kind")).toBe(Kind.ERROR)
    expect(wrapper.find("Alert").prop("body")).toContain(
      "Missing Submit Button"
    )

    // If the app restarts, we continue to show the error...
    wrapper.setProps({ scriptRunState: ScriptRunState.RUNNING })
    expect(wrapper.find("Alert").exists()).toBeTruthy()

    // Until we get a submit button, and the error is removed immediately,
    // regardless of ScriptRunState.
    wrapper.setProps({ hasSubmitButton: true })
    expect(wrapper.find("Alert").exists()).toBeFalsy()
  })
})
