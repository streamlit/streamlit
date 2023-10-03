/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import {
  AppContext,
  Props as AppContextProps,
} from "@streamlit/app/src/components/AppContext"
import {
  ScriptRunState,
  BlockNode,
  ElementNode,
  AppRoot,
  FileUploadClient,
  createFormsData,
  WidgetStateManager,
  ChatInput as ChatInputProto,
  ForwardMsgMetadata,
  PageConfig,
  Element,
  makeElementWithInfoText,
  ComponentRegistry,
  mockEndpoints,
  mockSessionInfo,
  render,
  Block as BlockProto,
} from "@streamlit/lib"
import AppView, { AppViewProps } from "./AppView"

// Mock needed for Block.tsx
class ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}
window.ResizeObserver = ResizeObserver

function getContextOutput(context: Partial<AppContextProps>): AppContextProps {
  return {
    wideMode: false,
    initialSidebarState: PageConfig.SidebarState.AUTO,
    embedded: false,
    showPadding: false,
    disableScrolling: false,
    showFooter: false,
    showToolbar: false,
    showColoredLine: false,
    pageLinkBaseUrl: "",
    sidebarChevronDownshift: 0,
    toastAdjustment: false,
    ...context,
  }
}

function getProps(props: Partial<AppViewProps> = {}): AppViewProps {
  const formsData = createFormsData()

  const sessionInfo = mockSessionInfo()
  const endpoints = mockEndpoints()

  return {
    endpoints: endpoints,
    elements: AppRoot.empty(),
    sendMessageToHost: jest.fn(),
    sessionInfo: sessionInfo,
    scriptRunId: "script run 123",
    scriptRunState: ScriptRunState.NOT_RUNNING,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(),
    }),
    uploadClient: new FileUploadClient({
      sessionInfo: sessionInfo,
      endpoints: endpoints,
      formsWithPendingRequestsChanged: () => {},
      requestFileURLs: jest.fn(),
    }),
    widgetsDisabled: true,
    componentRegistry: new ComponentRegistry(endpoints),
    formsData,
    appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
    onPageChange: jest.fn(),
    currentPageScriptHash: "main_page_script_hash",
    hideSidebarNav: false,
    ...props,
  }
}

describe("AppView element", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders without crashing", () => {
    render(<AppView {...getProps()} />)
    expect(screen.getByTestId("stAppViewContainer")).toBeInTheDocument()
  })

  it("does not render a sidebar when there are no elements and only one page", () => {
    const props = getProps()
    render(<AppView {...props} />)

    const sidebar = screen.queryByTestId("stSidebar")
    expect(sidebar).not.toBeInTheDocument()
  })

  it("renders a sidebar when there are elements and only one page", () => {
    const sidebarElement = new ElementNode(
      makeElementWithInfoText("sidebar!"),
      ForwardMsgMetadata.create({}),
      "no script run id"
    )

    const sidebar = new BlockNode(
      [sidebarElement],
      new BlockProto({ allowEmpty: true })
    )

    const main = new BlockNode([], new BlockProto({ allowEmpty: true }))
    const event = new BlockNode([], new BlockProto({ allowEmpty: true }))

    const props = getProps({
      elements: new AppRoot(new BlockNode([main, sidebar, event])),
    })
    render(<AppView {...props} />)

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("renders a sidebar when there are no elements but multiple pages", () => {
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    render(<AppView {...getProps({ appPages })} />)

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("renders a sidebar when there are elements and multiple pages", () => {
    const sidebarElement = new ElementNode(
      makeElementWithInfoText("sidebar!"),
      ForwardMsgMetadata.create({}),
      "no script run id"
    )

    const sidebar = new BlockNode(
      [sidebarElement],
      new BlockProto({ allowEmpty: true })
    )

    const main = new BlockNode([], new BlockProto({ allowEmpty: true }))
    const event = new BlockNode([], new BlockProto({ allowEmpty: true }))

    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    const props = getProps({
      elements: new AppRoot(new BlockNode([main, sidebar, event])),
      appPages,
    })
    render(<AppView {...props} />)

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("does not render the sidebar if there are no elements, multiple pages but hideSidebarNav is true", () => {
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    const props = getProps({
      appPages,
      hideSidebarNav: true,
    })
    render(<AppView {...props} />)

    const sidebar = screen.queryByTestId("stSidebar")
    expect(sidebar).not.toBeInTheDocument()
  })

  it("does not render the wide class", () => {
    const realUseContext = React.useContext
    jest.spyOn(React, "useContext").mockImplementation(input => {
      if (input === AppContext) {
        return getContextOutput({ wideMode: false, embedded: false })
      }

      return realUseContext(input)
    })

    const main = new BlockNode([], new BlockProto({ allowEmpty: true }))
    const sidebar = new BlockNode([], new BlockProto({ allowEmpty: true }))
    const event = new BlockNode([], new BlockProto({ allowEmpty: true }))

    const props = getProps({
      elements: new AppRoot(new BlockNode([main, sidebar, event])),
    })
    render(<AppView {...props} />)

    const style = window.getComputedStyle(
      screen.getByTestId("block-container")
    )
    expect(style.maxWidth).not.toEqual("initial")
  })

  it("does render the wide class when specified", () => {
    const realUseContext = React.useContext
    jest.spyOn(React, "useContext").mockImplementation(input => {
      if (input === AppContext) {
        return getContextOutput({ wideMode: true, embedded: false })
      }

      return realUseContext(input)
    })
    render(<AppView {...getProps()} />)
    const style = window.getComputedStyle(
      screen.getByTestId("block-container")
    )
    expect(style.maxWidth).toEqual("initial")
  })

  it("opens link to streamlit.io in new tab", () => {
    render(<AppView {...getProps()} />)
    const link = screen.getByRole("link", { name: "Streamlit" })
    expect(link).toHaveAttribute("href", "//streamlit.io")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("renders the Spacer and Footer when not embedded", () => {
    const realUseContext = React.useContext
    jest.spyOn(React, "useContext").mockImplementation(input => {
      if (input === AppContext) {
        return getContextOutput({ wideMode: false, embedded: false })
      }

      return realUseContext(input)
    })

    render(<AppView {...getProps()} />)

    expect(screen.getByTestId("AppViewBlockSpacer")).toBeInTheDocument()
    expect(screen.getByRole("contentinfo")).toBeInTheDocument()
  })

  it("does not render the Spacer and Footer when embedded", () => {
    const realUseContext = React.useContext
    jest.spyOn(React, "useContext").mockImplementation(input => {
      if (input === AppContext) {
        return getContextOutput({ wideMode: false, embedded: true })
      }

      return realUseContext(input)
    })

    render(<AppView {...getProps()} />)

    expect(screen.queryByTestId("AppViewBlockSpacer")).not.toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
  })

  describe("when window.location.hash changes", () => {
    let originalLocation: Location
    beforeEach(() => (originalLocation = window.location))
    afterEach(() => (window.location = originalLocation))

    it("sends UPDATE_HASH message to host", () => {
      const sendMessageToHost = jest.fn()
      render(<AppView {...getProps({ sendMessageToHost })} />)

      window.location.hash = "mock_hash"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
      expect(sendMessageToHost).toHaveBeenCalledWith({
        hash: "#mock_hash",
        type: "UPDATE_HASH",
      })
    })
  })

  it("does not render a Scroll To Bottom container when no chat input is present", () => {
    const props = getProps()
    render(<AppView {...props} />)

    const stbContainer = screen.queryByTestId("ScrollToBottomContainer")
    expect(stbContainer).not.toBeInTheDocument()
  })

  it("renders a Scroll To Bottom container when a chat input is present", () => {
    const chatInputElement = new ElementNode(
      new Element({
        chatInput: {
          id: "123",
          placeholder: "Enter Text Here",
          disabled: false,
          default: "",
          position: ChatInputProto.Position.BOTTOM,
        },
      }),
      ForwardMsgMetadata.create({}),
      "no script run id"
    )

    const sidebar = new BlockNode([], new BlockProto({ allowEmpty: true }))
    const event = new BlockNode([], new BlockProto({ allowEmpty: true }))

    const main = new BlockNode(
      [chatInputElement],
      new BlockProto({ allowEmpty: true })
    )
    const props = getProps({
      elements: new AppRoot(new BlockNode([main, sidebar, event])),
    })

    render(<AppView {...props} />)

    const stbContainer = screen.queryByTestId("ScrollToBottomContainer")
    expect(stbContainer).toBeInTheDocument()
  })
})
