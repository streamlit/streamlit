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

import { ElementNode, ReportRoot } from "./ReportNode"

describe("ReportRoot.empty", () => {
  it("creates an empty tree", () => {
    const empty = ReportRoot.empty()
    expect(empty.main.isEmpty).toBe(true)
    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates placeholder alert", () => {
    const empty = ReportRoot.empty("placeholder text!")

    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.alert?.body).toBe("placeholder text!")

    expect(empty.sidebar.isEmpty).toBe(true)
  })
})

describe("ReportRoot.applyDelta", () => {})
