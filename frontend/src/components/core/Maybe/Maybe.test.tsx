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

import { ReactWrapper } from "enzyme"
import React from "react"
import { mount } from "src/lib/test_util"
import Maybe from "./Maybe"

interface OuterProps {
  name: string
}

interface InnerProps {
  name: string
}
const Inner = (props: InnerProps): any => <div>{props.name}</div>

describe("The Maybe component", () => {
  describe("when enable is true", () => {
    let component: ReactWrapper

    beforeEach(() => {
      const Outer = (props: OuterProps): any => (
        <Maybe enable={true}>
          <Inner name={props.name} />
        </Maybe>
      )
      component = mount(<Outer name={"old again"} />)
    })

    afterEach(() => {
      component.unmount()
      jest.restoreAllMocks()
    })

    it("should invoke the render method when the props of an enclosing element update", () => {
      const spyShouldComponentUpdate = jest.spyOn(
        Maybe.prototype,
        "shouldComponentUpdate"
      )
      const spyRender = jest.spyOn(Maybe.prototype, "render")
      component.setProps({ name: "new name" })
      expect(spyShouldComponentUpdate).toHaveBeenCalled()
      expect(spyRender).toHaveBeenCalled()
    })

    it("should call render() when a Maybe is first disabled", () => {
      const spyShouldComponentUpdate = jest.spyOn(
        Maybe.prototype,
        "shouldComponentUpdate"
      )
      const spyRender = jest.spyOn(Maybe.prototype, "render")
      component.setProps({ name: "new name", enable: false })
      expect(spyShouldComponentUpdate).toHaveBeenCalled()
      expect(spyRender).toHaveBeenCalled()
    })
  })

  describe("when enable is false", () => {
    let component: ReactWrapper

    beforeEach(() => {
      const Outer = (props: OuterProps): any => (
        <Maybe enable={false}>
          <Inner name={props.name} />
        </Maybe>
      )
      component = mount(<Outer name={"old again"} />)
    })

    afterEach(() => {
      component.unmount()
      jest.restoreAllMocks()
    })

    it("should not invoke the render method when the props of an enclosing element update", () => {
      const spyShouldComponentUpdate = jest.spyOn(
        Maybe.prototype,
        "shouldComponentUpdate"
      )
      const spyRender = jest.spyOn(Maybe.prototype, "render")
      component.setProps({ name: "new name" })
      expect(spyShouldComponentUpdate).toHaveBeenCalled()
      expect(spyRender).toHaveBeenCalledTimes(0)
    })
  })
})
