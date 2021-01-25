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

import React, { ReactElement } from "react"
import { shallow } from "lib/test_util"

import withS4ACommunication, {
  S4ACommunicationHOC,
} from "./withS4ACommunication"

const testComponent = (props: {
  s4aCommunication: S4ACommunicationHOC
}): ReactElement => {
  props.s4aCommunication.connect()

  return <div>test</div>
}

describe("withS4ACommunication HOC", () => {
  it("renders without crashing", () => {
    const WithHoc = withS4ACommunication(testComponent)
    const wrapper = shallow(<WithHoc />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have s4aCommunication prop", () => {
    const WithHoc = withS4ACommunication(testComponent)
    const wrapper = shallow(<WithHoc />)

    expect(wrapper.find(testComponent).prop("s4aCommunication")).toBeDefined()
  })

  it("s4a should receive a GUEST_READY message", done => {
    const WithHoc = withS4ACommunication(testComponent)

    shallow(<WithHoc />)

    const listener = (event: MessageEvent): void => {
      expect(event.data).toStrictEqual({
        stCommVersion: 1,
        type: "GUEST_READY",
      })

      window.removeEventListener("message", listener)
      done()
    }

    window.addEventListener("message", listener)
  })
})
