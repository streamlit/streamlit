/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { Kind } from "src/components/shared/AlertContainer"
import { shallow } from "src/lib/test_util"
import { Form, Props, SUBMIT_BUTTON_WARNING_TIME_MS } from "./Form"

// We have some timeouts that we want to use fake timers for.
jest.useFakeTimers()

describe("Form", () => {
  function getProps(props: Partial<Props> = {}): Props {
    return {
      formId: "mockFormId",
      width: 100,
      hasSubmitButton: false,
      ...props,
    }
  }

  it("sets submitButtonTimeout after a timeout", () => {
    const props = getProps()
    const wrapper = shallow(<Form {...props} />)
    expect(wrapper.state("submitButtonTimeout")).toBe(false)

    // Advance our timer and force a rerender
    jest.advanceTimersByTime(SUBMIT_BUTTON_WARNING_TIME_MS)
    expect(wrapper.state("submitButtonTimeout")).toBe(true)
  })

  it("shows error if !hasSubmitButton && submitButtonTimeout", () => {
    const props = getProps({ hasSubmitButton: false })
    const wrapper = shallow(<Form {...props} />)
    wrapper.setState({ submitButtonTimeout: true })

    expect(wrapper.find("Alert").exists()).toBeTruthy()
    expect(wrapper.find("Alert").prop("kind")).toBe(Kind.ERROR)
    expect(wrapper.find("Alert").prop("body")).toContain(
      "Missing Submit Button"
    )

    // If we later get a submit button, our alert should go away.
    wrapper.setProps({ hasSubmitButton: true })
    expect(wrapper.find("Alert").exists()).toBeFalsy()
  })
})
