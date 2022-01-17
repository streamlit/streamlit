/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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
import { Block as BlockProto, ForwardMsgMetadata } from "src/autogen/proto"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { BlockNode, ElementNode, AppRoot } from "src/lib/AppNode"
import { FileUploadClient } from "src/lib/FileUploadClient"
import {
  createFormsData,
  WidgetStateManager,
} from "src/lib/WidgetStateManager"
import { makeElementWithInfoText } from "src/lib/utils"
import { ComponentRegistry } from "src/components/widgets/CustomComponent"
import AppView, { AppViewProps } from "./AppView"

function getProps(props: Partial<AppViewProps> = {}): AppViewProps {
  const formsData = createFormsData()

  return {
    elements: AppRoot.empty(),
    scriptRunId: "report 123",
    scriptRunState: ScriptRunState.NOT_RUNNING,
    showStaleElementIndicator: true,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(),
    }),
    uploadClient: new FileUploadClient({
      getServerUri: () => undefined,
      csrfEnabled: true,
      formsWithPendingRequestsChanged: () => {},
    }),
    widgetsDisabled: true,
    componentRegistry: new ComponentRegistry(() => undefined),
    formsData,
    ...props,
  }
}

describe("AppView element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<AppView {...props} />)

    expect(wrapper).toBeDefined()
  })

  it("does not render a sidebar when there are no elements", () => {
    const props = getProps()
    const wrapper = shallow(<AppView {...props} />)

    expect(wrapper.find("[data-testid='stSidebar']").exists()).toBe(false)
  })

  it("renders a sidebar when there are elements", () => {
    const sidebarElement = new ElementNode(
      makeElementWithInfoText("sidebar!"),
      ForwardMsgMetadata.create({}),
      "no report id"
    )

    const sidebar = new BlockNode(
      [sidebarElement],
      new BlockProto({ allowEmpty: true })
    )

    const main = new BlockNode([], new BlockProto({ allowEmpty: true }))

    const props = getProps({
      elements: new AppRoot(new BlockNode([main, sidebar])),
    })
    const wrapper = shallow(<AppView {...props} />)

    expect(wrapper.find("ThemedSidebar").exists()).toBe(true)
  })

  it("does not render the wide class", () => {
    jest
      .spyOn(React, "useContext")
      .mockImplementation(() => ({ wideMode: false, embedded: false }))
    const wrapper = shallow(<AppView {...getProps()} />)

    expect(
      wrapper.find("StyledAppViewBlockContainer").prop("isWideMode")
    ).toBe(false)

    expect(wrapper.find("StyledAppViewFooter").prop("isWideMode")).toBe(false)
  })

  it("does render the wide class when specified", () => {
    jest
      .spyOn(React, "useContext")
      .mockImplementation(() => ({ wideMode: true, embedded: false }))
    const wrapper = shallow(<AppView {...getProps()} />)

    expect(
      wrapper.find("StyledAppViewBlockContainer").prop("isWideMode")
    ).toBe(true)

    expect(wrapper.find("StyledAppViewFooter").prop("isWideMode")).toBe(true)
  })
})
