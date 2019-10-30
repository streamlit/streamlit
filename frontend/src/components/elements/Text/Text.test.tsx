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
import { Text as TextProto } from "autogen/proto"
import Text, { Props } from "./Text"

const getProps = (props: object = {}): Props => ({
  element: ImmutableMap({
    body: "",
    format: TextProto.Format.PLAIN,
    ...props,
  }),
  width: 0,
})

it("renders without crashing", () => {
  const props = getProps()
  const wrapper = shallow(<Text {...props} />)
  expect(wrapper).toBeDefined()
})
