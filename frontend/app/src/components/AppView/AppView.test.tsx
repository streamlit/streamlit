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

import React from "react"

import "@testing-library/jest-dom"
import { screen, within } from "@testing-library/react"

import {
  AppRoot,
  BlockNode,
  Block as BlockProto,
  ComponentRegistry,
  createFormsData,
  Element,
  ElementNode,
  FileUploadClient,
  ForwardMsgMetadata,
  Logo as LogoProto,
  makeElementWithInfoText,
  mockEndpoints,
  mockSessionInfo,
  PageConfig,
  render,
  ScriptRunState,
  WidgetStateManager,
} from "@streamlit/lib"
import {
  AppContext,
  Props as AppContextProps,
} from "@streamlit/app/src/components/AppContext"

import AppView, { AppViewProps } from "./AppView"

// Mock needed for Block.tsx
class ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}
window.ResizeObserver = ResizeObserver

const FAKE_SCRIPT_HASH = "fake_script_hash"

function getContextOutput(context: Partial<AppContextProps>): AppContextProps {
  return {
    wideMode: false,
    initialSidebarState: PageConfig.SidebarState.AUTO,
    embedded: false,
    showPadding: false,
    disableScrolling: false,
    showToolbar: false,
    showColoredLine: false,
    pageLinkBaseUrl: "",
    sidebarChevronDownshift: 0,
    ...context,
  }
}

const mockEndpointProp = mockEndpoints()

function getProps(props: Partial<AppViewProps> = {}): AppViewProps {
  const formsData = createFormsData()

  const sessionInfo = mockSessionInfo()

  return {
    endpoints: mockEndpointProp,
    elements: AppRoot.empty(FAKE_SCRIPT_HASH, true),
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
      endpoints: mockEndpointProp,
      formsWithPendingRequestsChanged: () => {},
      requestFileURLs: jest.fn(),
    }),
    widgetsDisabled: true,
    componentRegistry: new ComponentRegistry(mockEndpointProp),
    formsData,
    appLogo: null,
    appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
    navSections: [],
    onPageChange: jest.fn(),
    currentPageScriptHash: "main_page_script_hash",
    hideSidebarNav: false,
    expandSidebarNav: false,
    ...props,
  }
}

describe("AppView element", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders without crashing", () => {
    render(<AppView {...getProps()} />)
    const appViewContainer = screen.getByTestId("stAppViewContainer")
    expect(appViewContainer).toBeInTheDocument()
    expect(appViewContainer).toHaveClass("stAppViewContainer")
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
      "no script run id",
      FAKE_SCRIPT_HASH
    )

    const sidebar = new BlockNode(
      FAKE_SCRIPT_HASH,
      [sidebarElement],
      new BlockProto({ allowEmpty: true })
    )

    const main = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const event = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const bottom = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )

    const props = getProps({
      elements: new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      ),
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

  it("does not render a sidebar when there are no elements, multiple pages, and hideSidebarNav is true", () => {
    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    render(<AppView {...getProps({ appPages, hideSidebarNav: true })} />)

    const sidebar = screen.queryByTestId("stSidebar")
    expect(sidebar).not.toBeInTheDocument()
  })

  it("renders a sidebar when there are elements and multiple pages", () => {
    const sidebarElement = new ElementNode(
      makeElementWithInfoText("sidebar!"),
      ForwardMsgMetadata.create({}),
      "no script run id",
      FAKE_SCRIPT_HASH
    )

    const sidebar = new BlockNode(
      FAKE_SCRIPT_HASH,
      [sidebarElement],
      new BlockProto({ allowEmpty: true })
    )

    const main = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const event = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const bottom = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )

    const appPages = [
      { pageName: "streamlit_app", pageScriptHash: "page_hash" },
      { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
    ]
    const props = getProps({
      elements: new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      ),
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

    const main = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const sidebar = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const event = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const bottom = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )

    const props = getProps({
      elements: new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      ),
    })
    render(<AppView {...props} />)

    const style = window.getComputedStyle(
      screen.getByTestId("stMainBlockContainer")
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
      screen.getByTestId("stMainBlockContainer")
    )
    expect(style.maxWidth).toEqual("initial")
  })

  describe("handles padding an embedded app", () => {
    it("embedded triggers default padding", () => {
      const realUseContext = React.useContext
      jest.spyOn(React, "useContext").mockImplementation(input => {
        if (input === AppContext) {
          return getContextOutput({ embedded: true })
        }

        return realUseContext(input)
      })
      render(<AppView {...getProps()} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("2.1rem")
      expect(style.paddingBottom).toEqual("1rem")
    })

    it("showPadding triggers expected padding", () => {
      const realUseContext = React.useContext
      jest.spyOn(React, "useContext").mockImplementation(input => {
        if (input === AppContext) {
          return getContextOutput({ showPadding: true })
        }

        return realUseContext(input)
      })
      render(<AppView {...getProps()} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("6rem")
      expect(style.paddingBottom).toEqual("10rem")
    })

    it("showToolbar triggers expected top padding", () => {
      const realUseContext = React.useContext
      jest.spyOn(React, "useContext").mockImplementation(input => {
        if (input === AppContext) {
          return getContextOutput({ showToolbar: true })
        }

        return realUseContext(input)
      })
      render(<AppView {...getProps()} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("4.5rem")
      expect(style.paddingBottom).toEqual("1rem")
    })

    it("hasSidebar triggers expected top padding", () => {
      const realUseContext = React.useContext
      jest.spyOn(React, "useContext").mockImplementation(input => {
        if (input === AppContext) {
          return getContextOutput({ embedded: true })
        }

        return realUseContext(input)
      })

      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar!"),
        ForwardMsgMetadata.create({}),
        "no script run id",
        FAKE_SCRIPT_HASH
      )

      const sidebar = new BlockNode(
        FAKE_SCRIPT_HASH,
        [sidebarElement],
        new BlockProto({ allowEmpty: true })
      )

      const empty = new BlockNode(
        FAKE_SCRIPT_HASH,
        [],
        new BlockProto({ allowEmpty: true })
      )

      const props = getProps({
        elements: new AppRoot(
          FAKE_SCRIPT_HASH,
          new BlockNode(FAKE_SCRIPT_HASH, [empty, sidebar, empty, empty])
        ),
      })

      render(<AppView {...props} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("4.5rem")
      expect(style.paddingBottom).toEqual("1rem")
    })
  })

  describe("handles logo rendering with no sidebar", () => {
    const imageOnly = LogoProto.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
    })

    const imageWithLink = LogoProto.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
    })

    const imageWithSize = LogoProto.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      size: "large",
    })

    const fullAppLogo = LogoProto.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
      iconImage: "https://docs.streamlit.io/logo.svg",
    })

    it("doesn't render if no logo provided", () => {
      render(<AppView {...getProps()} />)
      expect(screen.queryByTestId("stLogo")).not.toBeInTheDocument()
    })

    it("uses iconImage if provided", () => {
      const sourceSpy = jest.spyOn(mockEndpointProp, "buildMediaURL")
      render(<AppView {...getProps({ appLogo: fullAppLogo })} />)
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId("stLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://docs.streamlit.io/logo.svg"
      )
      expect(collapsedLogo).toHaveClass("stLogo")
    })

    it("defaults to image if no iconImage", () => {
      const sourceSpy = jest.spyOn(mockEndpointProp, "buildMediaURL")
      render(<AppView {...getProps({ appLogo: imageOnly })} />)
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId("stLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("default no link with image size medium", () => {
      render(<AppView {...getProps({ appLogo: imageOnly })} />)
      expect(screen.queryByTestId("stLogoLink")).not.toBeInTheDocument()
      expect(screen.getByTestId("stLogo")).toHaveStyle({ height: "1.5rem" })
    })

    it("link with image if provided", () => {
      render(<AppView {...getProps({ appLogo: imageWithLink })} />)
      expect(screen.getByTestId("stLogoLink")).toHaveAttribute(
        "href",
        "www.example.com"
      )
    })

    it("renders logo - large size when specified", () => {
      render(<AppView {...getProps({ appLogo: imageWithSize })} />)
      expect(screen.getByTestId("stLogo")).toHaveStyle({ height: "2rem" })
    })
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

  it("does not render a Scroll To Bottom container when no bottom container is present", () => {
    const props = getProps()
    render(<AppView {...props} />)

    const stbContainer = screen.queryByTestId("stAppScrollToBottomContainer")
    expect(stbContainer).not.toBeInTheDocument()
  })

  it("renders a Scroll To Bottom container if there is an element in the bottom container.", () => {
    const chatInputElement = new ElementNode(
      new Element({
        chatInput: {
          id: "123",
          placeholder: "Enter Text Here",
          disabled: false,
          default: "",
        },
      }),
      ForwardMsgMetadata.create({}),
      "no script run id",
      FAKE_SCRIPT_HASH
    )

    const main = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const sidebar = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const event = new BlockNode(
      FAKE_SCRIPT_HASH,
      [],
      new BlockProto({ allowEmpty: true })
    )
    const bottom = new BlockNode(
      FAKE_SCRIPT_HASH,
      [chatInputElement],
      new BlockProto({ allowEmpty: true })
    )

    const props = getProps({
      elements: new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      ),
    })

    render(<AppView {...props} />)

    const stbContainer = screen.queryByTestId("stAppScrollToBottomContainer")
    expect(stbContainer).toBeInTheDocument()
  })
})
