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
import { shallow } from "src/lib/test_util"

import InputInstructions, { Props } from "./InputInstructions"

const getProps = (props: Partial<Props> = {}): Props => ({
  dirty: true,
  value: "asd",
  ...props,
})

describe("InputInstructions", () => {
  const props = getProps()
  const wrapper = shallow(<InputInstructions {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.text()).toBeDefined()
  })

  it("should show Enter instructions", () => {
    expect(wrapper.text()).toBe("Press Enter to apply")
  })

  describe("Multiline type", () => {
    const props = getProps({
      type: "multiline",
    })
    const wrapper = shallow(<InputInstructions {...props} />)

    it("should show Ctrl+Enter instructions", () => {
      expect(wrapper.text()).toBe("Press Ctrl+Enter to apply")
    })

    it("show ⌘+Enter instructions", () => {
      Object.defineProperty(navigator, "platform", {
        value: "MacIntel",
        writable: true,
      })

      const props = getProps({
        type: "multiline",
      })
      const wrapper = shallow(<InputInstructions {...props} />)

      expect(wrapper.text()).toBe("Press ⌘+Enter to apply")
    })

    it("should show instructions for max length", () => {
      const props = getProps({
        type: "multiline",
        maxLength: 3,
      })
      const wrapper = shallow(<InputInstructions {...props} />)

      expect(wrapper.text()).toBe("Press ⌘+Enter to apply3/3")
    })
  })

  it("should show instructions for max length", () => {
    const props = getProps({
      maxLength: 3,
    })
    const wrapper = shallow(<InputInstructions {...props} />)

    expect(wrapper.text()).toBe("Press Enter to apply3/3")
  })
})
