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
import { Map as ImmutableMap } from "immutable"
import Json from "./Json"
import renderer from "react-test-renderer"

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

describe("JSON Element Test", () => {
  it("renders json as expected", () => {
    const props = getProps()
    const component = renderer.create(<Json {...props} />)
    let tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  /* TODO:
    Same here as before, here you can check a few things:

    1- Should render without exploding
    2- Should have a bodyObject
    3- Should raise an exception if it has an invalid JSON
    4- Should have have styleProp
  */
})
