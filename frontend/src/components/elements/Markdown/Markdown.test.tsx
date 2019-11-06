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
import { shallow } from "enzyme"
import { Map as ImmutableMap } from "immutable"
import Markdown from "./Markdown"

const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    body:
      "Emphasis, aka italics, with *asterisks* or _underscores_." +
      "Combined emphasis with **asterisks and _underscores_**." +
      "[I'm an inline-style link with title](https://www.https://streamlit.io/ Streamlit",
    ...elementProps,
  }),
  width: 100,
})

describe("Markdown Element Test", () => {
  it("renders markdown as expected", () => {
    const props = getProps()
    const wrap = shallow(<Markdown {...props} />)
    expect(wrap).toBeDefined()
    expect(wrap.find(<Markdown>).hasClass('stMarkdown'))
    // expect('body' in wrap.props()).toEqual(true)
    //expect(wrap.find({ prop: "body" }).toBeDefined())
    expect(wrap.find({ prop: "width" }).toEqual(100))
    //expect(wrap.find('a').props.href).toBe('https://www.https://streamlit.io/')
  })
  /* TODO:
  a) unit tests with different Markdown formatted text
  b) check for className, styleProp
  */
})
