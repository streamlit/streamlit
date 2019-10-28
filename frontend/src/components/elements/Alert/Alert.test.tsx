/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import ReactDOM from "react-dom"
import { Map as ImmutableMap } from "immutable"
import Alert from "./Alert"
import renderer from "react-test-renderer"

const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    body: "Something happened!",
    ...elementProps,
  }),
  width: 100,
})

describe("Alert Element Test", () => {
  it("renders an ERROR box", () => {
    const props = getProps()
    const component = renderer.create(<Alert format="error" {...props} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders an INFO box", () => {
    const props = getProps()
    const component = renderer.create(<Alert format="info" {...props} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders a WARNING box", () => {
    const props = getProps()
    const component = renderer.create(<Alert format="warning" {...props} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders a SUCCESS box", () => {
    const props = getProps()
    const component = renderer.create(<Alert format="success" {...props} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
