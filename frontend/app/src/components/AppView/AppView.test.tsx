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

import React from "react"

import { fireEvent, screen, within } from "@testing-library/react"

import {
  AppRoot,
  BlockNode,
  ElementNode,
  FileUploadClient,
  makeElementWithInfoText,
  mockEndpoints,
  mockSessionInfo,
  render,
  WidgetStateManager,
} from "@streamlit/lib"
import {
  Block as BlockProto,
  Element,
  ForwardMsgMetadata,
  Logo as LogoProto,
  PageConfig,
} from "@streamlit/protobuf"
import { AppContextProps } from "@streamlit/app/src/components/AppContext"
import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"

import AppView, { AppViewProps } from "./AppView"

const FAKE_SCRIPT_HASH = "fake_script_hash"

function getContextOutput(context: Partial<AppContextProps>): AppContextProps {
  return {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    pageLinkBaseUrl: "",
    currentPageScriptHash: "",
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [],
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    widgetsDisabled: false,
    gitInfo: null,
    ...context,
  }
}

const buildMediaURL = vi.fn((url: string) => url)
const sendClientErrorToHost = vi.fn()
const mockEndpointProp = mockEndpoints({
  buildMediaURL,
  sendClientErrorToHost,
})

function getProps(props: Partial<AppViewProps> = {}): AppViewProps {
  const sessionInfo = mockSessionInfo()

  return {
    endpoints: mockEndpointProp,
    elements: AppRoot.empty(FAKE_SCRIPT_HASH, true),
    sendMessageToHost: vi.fn(),
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    uploadClient: new FileUploadClient({
      sessionInfo,
      endpoints: mockEndpointProp,
      formsWithPendingRequestsChanged: () => {},
      requestFileURLs: vi.fn(),
    }),
    appLogo: null,
    multiplePages: false,
    wideMode: false,
    embedded: false,
    addPaddingForHeader: false,
    showPadding: false,
    disableScrolling: false,
    hideSidebarNav: false,
    ...props,
  }
}

describe("AppView element", () => {
  beforeEach(() => {
    // Mock the useAppContext hook to return default values
    vi.spyOn(
      StreamlitContextProviderModule,
      "useAppContext"
    ).mockImplementation(() => getContextOutput({}))
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    render(<AppView {...getProps({ multiplePages: true })} />)

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("does not render a sidebar when there are no elements, multiple pages, and hideSidebarNav is true", () => {
    render(
      <AppView {...getProps({ multiplePages: true, hideSidebarNav: true })} />
    )

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

    const props = getProps({
      elements: new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      ),
      multiplePages: true,
    })
    render(<AppView {...props} />)

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("does not render the sidebar if there are no elements, multiple pages but hideSidebarNav is true", () => {
    const props = getProps({
      hideSidebarNav: true,
      multiplePages: true,
    })
    render(<AppView {...props} />)

    const sidebar = screen.queryByTestId("stSidebar")
    expect(sidebar).not.toBeInTheDocument()
  })

  it("does not render the wide class", () => {
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
    render(<AppView {...getProps({ wideMode: true })} />)
    const style = window.getComputedStyle(
      screen.getByTestId("stMainBlockContainer")
    )
    expect(style.maxWidth).toEqual("initial")
  })

  it("disables scrolling when disableScrolling is true", () => {
    render(<AppView {...getProps({ disableScrolling: true })} />)
    const style = window.getComputedStyle(screen.getByTestId("stMain"))
    expect(style.overflow).toEqual("hidden")
  })

  it("allows scrolling when disableScrolling is false", () => {
    render(<AppView {...getProps({ disableScrolling: false })} />)
    const style = window.getComputedStyle(screen.getByTestId("stMain"))
    expect(style.overflow).toEqual("auto")
  })

  describe("handles padding an embedded app", () => {
    it("embedded triggers default padding", () => {
      render(<AppView {...getProps({ embedded: true })} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("2.25rem")
      expect(style.paddingBottom).toEqual("1rem")
    })

    it("showPadding triggers expected padding", () => {
      render(<AppView {...getProps({ embedded: true, showPadding: true })} />)
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("6rem")
      expect(style.paddingBottom).toEqual("10rem")
    })

    it("addPaddingForHeader triggers expected top padding", () => {
      render(
        <AppView
          {...getProps({ embedded: true, addPaddingForHeader: true })}
        />
      )
      const style = window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
      expect(style.paddingTop).toEqual("4.5rem")
      expect(style.paddingBottom).toEqual("1rem")
    })

    it("hasSidebar triggers expected top padding", () => {
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
        embedded: true,
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
      expect(screen.queryByTestId("stHeaderLogo")).not.toBeInTheDocument()
    })

    it("uses iconImage if provided", () => {
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      render(<AppView {...getProps({ appLogo: fullAppLogo })} />)
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId(
        "stHeaderLogo"
      )
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://docs.streamlit.io/logo.svg"
      )
      expect(collapsedLogo).toHaveClass("stLogo")
    })

    it("defaults to image if no iconImage", () => {
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      render(<AppView {...getProps({ appLogo: imageOnly })} />)

      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId(
        "stHeaderLogo"
      )
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("default no link with image size medium", () => {
      render(<AppView {...getProps({ appLogo: imageOnly })} />)
      expect(screen.queryByTestId("stLogoLink")).not.toBeInTheDocument()
      expect(screen.getByTestId("stHeaderLogo")).toHaveStyle({
        height: "1.5rem",
      })
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
      expect(screen.getByTestId("stHeaderLogo")).toHaveStyle({
        height: "2rem",
      })
    })

    it("sends an CLIENT_ERROR message when the logo source fails to load", () => {
      const props = getProps({ appLogo: imageOnly })
      render(<AppView {...props} />)
      const logoElement = screen.getByTestId("stHeaderLogo")
      expect(logoElement).toBeInTheDocument()

      fireEvent.error(logoElement)

      expect(sendClientErrorToHost).toHaveBeenCalledWith(
        "Logo",
        "Logo source failed to load",
        "onerror triggered",
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })
  })

  describe("when window.location.hash changes", () => {
    let originalLocation: Location
    beforeEach(() => (originalLocation = window.location))
    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    })

    it("sends UPDATE_HASH message to host", () => {
      const sendMessageToHost = vi.fn()
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
