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
import { shallow } from "enzyme"
import { Map as ImmutableMap } from "immutable"
import Text, { Props } from "./Text"

const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    body: "some plain text",
    ...elementProps,
  }),
  width: 100,
})

describe("Text element", () => {
  it("renders preformatted text as expected", () => {
    const props = getProps()
    const wrap = shallow(<Text {...props} />)
    expect(wrap).toBeDefined()
    const elem = wrap.get(0)
    expect(wrap.text()).toBe("some plain text")
    expect(elem.props.className.includes("stText")).toBeTruthy()
  })
})
