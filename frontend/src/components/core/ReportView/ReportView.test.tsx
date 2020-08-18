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
import { List, Map } from "immutable"
import { PageConfig } from "autogen/proto"
import { ReportRunState } from "lib/ReportRunState"
import { FileUploadClient } from "lib/FileUploadClient"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { ComponentRegistry } from "../../widgets/CustomComponent"
import ReportView, { ReportViewProps } from "./ReportView"

const getProps = (
  propOverrides: Partial<ReportViewProps> = {}
): ReportViewProps => ({
  elements: {
    main: List(),
    sidebar: List(),
  },
  reportId: "report 123",
  reportRunState: ReportRunState.NOT_RUNNING,
  showStaleElementIndicator: true,
  widgetMgr: new WidgetStateManager(() => {}),
  uploadClient: new FileUploadClient(() => undefined, true),
  widgetsDisabled: true,
  wide: false,
  initialSidebarState: PageConfig.SidebarState.AUTO,
  componentRegistry: new ComponentRegistry(() => undefined),
  ...propOverrides,
})

describe("ReportView element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<ReportView {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("does not render a sidebar with no elements", () => {
    const props = getProps()
    const wrapper = shallow(<ReportView {...props} />)

    expect(wrapper.find("Sidebar").exists()).toBe(false)
  })

  it("does render a sidebar with no elements", () => {
    const props = getProps({
      elements: {
        main: List(),
        sidebar: List([Map({ key: "value" })]),
      },
    })
    const wrapper = shallow(<ReportView {...props} />)

    expect(wrapper.find("Sidebar").exists()).toBe(true)
  })

  it("does not render the wide class", () => {
    const props = getProps()
    const wrapper = shallow(<ReportView {...props} />)

    expect(
      wrapper
        .find("div")
        .first()
        .hasClass("--wide")
    ).toBe(false)
  })

  it("does render the wide class when specified", () => {
    const props = getProps({
      wide: true,
    })
    const wrapper = shallow(<ReportView {...props} />)
    expect(
      wrapper
        .find("div")
        .first()
        .hasClass("--wide")
    ).toBe(true)
  })
})
