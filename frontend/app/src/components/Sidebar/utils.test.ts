/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { PageConfig } from "@streamlit/protobuf"

import { shouldCollapse } from "./utils"

describe("shouldCollapse", () => {
  it("should collapse given state is collapsed", () => {
    expect(
      shouldCollapse(PageConfig.SidebarState.COLLAPSED, 50, 100)
    ).toBeTruthy()
  })

  it("should not collapse given state is expanded", () => {
    expect(
      shouldCollapse(PageConfig.SidebarState.EXPANDED, 50, 100)
    ).toBeFalsy()
  })

  it("should collapse given state is auto and width is less than breakpoint", () => {
    const windowInnerWidth = 40
    expect(
      shouldCollapse(PageConfig.SidebarState.AUTO, 50, windowInnerWidth)
    ).toBeTruthy()
  })

  it("should not collapse given state is auto and width greater less than breakpoint", () => {
    const windowInnerWidth = 60
    expect(
      shouldCollapse(PageConfig.SidebarState.AUTO, 50, windowInnerWidth)
    ).toBeFalsy()
  })
})
