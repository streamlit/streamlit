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

import Alert from "./Alert"
import ALERT_CSS_CLASS from "./Alert"
import { Alert as AlertProto } from "autogen/proto"
import renderer from "react-test-renderer"

const getProps = (elementProps: object = {}): Props => ({
  element: ImmutableMap({
    body: "Something happened!",
    ...elementProps,
  }),
  width: 100,
})

/*
const checkStyle = (alertobj: object, format: int): Null => ({

  cssStyle = ALERT_CSS_CLASS[format]
  //expect(alertobj.props.style).Contains(cssStyle)
})
*/

describe("Alert Element Test", () => {
  it("renders an ERROR box as expected", () => {
    const props = getProps({
      format: AlertProto.Format.ERROR,
      body: "#what in the world?",
    })
    const component = renderer.create(<Alert {...props} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders an INFO box as expected", () => {
    const props = getProps({
      format: AlertProto.Format.INFO,
      body: "It's dangerous to go alone.",
    })
    const component = renderer.create(<Alert {...props} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders a WARNING box as expected", () => {
    const props = getProps({
      format: AlertProto.Format.WARNING,
      body: "Are you sure?",
    })
    const component = renderer.create(<Alert {...props} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it("renders a SUCCESS box as expected", () => {
    const props = getProps({
      format: AlertProto.Format.SUCCESS,
      body: "But our princess was in another castle!",
    })
    const component = renderer.create(<Alert {...props} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  /* TODO:
  There are some behaviors that you can check with jest and enzyme here.
    For instance:

    1- Should render without exploding
    2- Should show body ( rendering ReactMarkdown with body properly passed as a prop )
    3- Should have the proper className
    4- Should have styleProp
  */
})
