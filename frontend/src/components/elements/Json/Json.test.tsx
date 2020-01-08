/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { Map as ImmutableMap } from "immutable"
import Json from "./Json"
import { shallow } from "enzyme"

const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    body:
      '{ "proper": [1,2,3],' +
      '  "nested": { "thing1": "cat", "thing2": "hat" },' +
      '  "json": "structure" }',
    ...elementProps,
  }),
  width: 100,
})

describe("JSON element", () => {
  it("renders json as expected", () => {
    const props = getProps()
    const wrapper = shallow(<Json {...props} />)
    expect(wrapper).toBeDefined()
    const elem = wrapper.get(0)
    expect(elem.props.className.includes("stJson")).toBeTruthy()
  })

  it("should raise an exception with invalid JSON", () => {
    const props = getProps({ body: "invalid JSON" })
    expect(() => {
      shallow(<Json {...props} />)
    }).toThrow(SyntaxError)
  })
})
