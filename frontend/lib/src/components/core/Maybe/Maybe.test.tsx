/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { FC } from "react"

import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"

import Maybe from "./Maybe"

interface OuterProps {
  name: string
  enable: boolean
}

interface InnerProps {
  name: string
}

let innerRenderCount = 0
const Inner: FC<InnerProps> = props => {
  // Side-effect: mutable variable for testing render counts
  innerRenderCount += 1
  return <div>{props.name}</div>
}

const Outer: FC<OuterProps> = props => (
  <Maybe enable={props.enable}>
    <Inner name={props.name} />
  </Maybe>
)

describe("The Maybe component", () => {
  beforeEach(() => {
    innerRenderCount = 0
  })

  describe("when enable is true", () => {
    it("should render when the props of an enclosing element update", () => {
      const { rerender } = render(<Outer name={"old again"} enable={true} />)

      expect(innerRenderCount).toBe(1)
      expect(screen.getByText("old again")).toBeVisible()

      rerender(<Outer name={"new name"} enable={true} />)

      expect(innerRenderCount).toBe(2)
      expect(screen.getByText("new name")).toBeVisible()
    })

    it("should update when a Maybe is first disabled", () => {
      const { rerender } = render(<Outer name={"old again"} enable={false} />)

      expect(innerRenderCount).toBe(1)
      expect(screen.getByText("old again")).toBeVisible()

      rerender(<Outer name={"new name"} enable={true} />)

      expect(innerRenderCount).toBe(2)
      // Because enable changes between renders, the inner component should be
      // rerendered.
      expect(screen.queryByText("new name")).toBeVisible()
    })
  })

  describe("when enable is false", () => {
    it("should not render children when disabled", () => {
      const { rerender } = render(<Outer name={"old again"} enable={false} />)

      expect(innerRenderCount).toBe(1)
      expect(screen.queryByText("old again")).toBeVisible()

      rerender(<Outer name={"new name"} enable={false} />)
      rerender(<Outer name={"new name"} enable={false} />)
      rerender(<Outer name={"new name"} enable={false} />)

      // Despite rerendering multiple times, the inner component should only
      // render once at the start.
      expect(innerRenderCount).toBe(1)
      expect(screen.queryByText("old again")).toBeVisible()
      expect(screen.queryByText("new name")).not.toBeInTheDocument()
    })
  })
})
