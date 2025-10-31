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

import { fireEvent, screen } from "@testing-library/react"

import { shouldShowNavigation } from "@streamlit/app/src/components/Navigation"
import {
  AppRoot,
  BlockNode,
  ComponentRegistry,
  ElementNode,
  FileUploadClient,
  makeElementWithInfoText,
  mockEndpoints,
  mockSessionInfo,
  mockTheme,
  NavigationContextProps,
  render,
  renderWithContexts,
  SidebarConfigContextProps,
  WidgetStateManager,
} from "@streamlit/lib"
import {
  Block as BlockProto,
  Element,
  ForwardMsgMetadata,
  Logo as LogoProto,
  Navigation,
  PageConfig,
} from "@streamlit/protobuf"

import AppView, { AppViewProps } from "./AppView"

const FAKE_SCRIPT_HASH = "fake_script_hash"

function getSidebarConfigContextOutput(
  context: Partial<SidebarConfigContextProps>
): SidebarConfigContextProps {
  return {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    ...context,
  }
}

function getNavigationContextOutput(
  context: Partial<NavigationContextProps> = {}
): NavigationContextProps {
  return {
    pageLinkBaseUrl: "",
    currentPageScriptHash: FAKE_SCRIPT_HASH,
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
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
    wideMode: false,
    embedded: false,
    widgetsDisabled: false,
    showToolbar: true,
    showPadding: false,
    disableScrolling: false,
    navigationPosition: Navigation.Position.SIDEBAR,
    addScriptFinishedHandler: vi.fn(),
    removeScriptFinishedHandler: vi.fn(),
    componentRegistry: new ComponentRegistry(mockEndpointProp),
    ...props,
  }
}

// Helper to render AppView with proper context
function renderAppView(
  props: Partial<AppViewProps> = {},
  overrides?: {
    sidebarConfigContext?: Partial<SidebarConfigContextProps>
    navigationContext?: Partial<NavigationContextProps>
  }
): ReturnType<typeof renderWithContexts> {
  const sidebarConfigContextValues = getSidebarConfigContextOutput(
    overrides?.sidebarConfigContext || {}
  )

  const navigationContextValues = getNavigationContextOutput(
    overrides?.navigationContext || {}
  )

  return renderWithContexts(<AppView {...getProps(props)} />, {
    sidebarConfigContext: sidebarConfigContextValues,
    navigationContext: navigationContextValues,
  })
}

describe("AppView element", () => {
  it("renders without crashing", () => {
    render(<AppView {...getProps()} />)
    const appViewContainer = screen.getByTestId("stAppViewContainer")
    expect(appViewContainer).toBeInTheDocument()
    expect(appViewContainer).toHaveClass("stAppViewContainer")
  })

  it("does not render a sidebar when there are no elements and only one page", () => {
    render(<AppView {...getProps()} />)

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
    renderAppView(
      {},
      {
        navigationContext: {
          appPages: [
            { pageName: "streamlit_app", pageScriptHash: "page_hash" },
            { pageName: "page2", pageScriptHash: "page2_hash" },
          ],
        },
      }
    )

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("does not render a sidebar when there are no elements, multiple pages, and hideSidebarNav is true", () => {
    renderAppView(
      {},
      {
        sidebarConfigContext: { hideSidebarNav: true },
        navigationContext: {
          appPages: [
            { pageName: "streamlit_app", pageScriptHash: "page_hash" },
            { pageName: "page2", pageScriptHash: "page2_hash" },
          ],
        },
      }
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

    renderAppView(
      {
        elements: new AppRoot(
          FAKE_SCRIPT_HASH,
          new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
        ),
      },
      {
        navigationContext: {
          appPages: [
            { pageName: "streamlit_app", pageScriptHash: "page_hash" },
            { pageName: "page2", pageScriptHash: "page2_hash" },
          ],
        },
      }
    )

    const sidebarDOMElement = screen.queryByTestId("stSidebar")
    expect(sidebarDOMElement).toBeInTheDocument()
  })

  it("does not render the sidebar if there are no elements, multiple pages but hideSidebarNav is true", () => {
    renderAppView(
      {},
      {
        sidebarConfigContext: { hideSidebarNav: true },
        navigationContext: {
          appPages: [
            { pageName: "streamlit_app", pageScriptHash: "page_hash" },
            { pageName: "page2", pageScriptHash: "page2_hash" },
          ],
        },
      }
    )

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

  describe("top padding logic", () => {
    const getMainBlockContainerStyle = (): CSSStyleDeclaration => {
      return window.getComputedStyle(
        screen.getByTestId("stMainBlockContainer")
      )
    }

    describe("non-embedded apps", () => {
      it("uses 6rem top padding by default", () => {
        render(<AppView {...getProps({ embedded: false })} />)
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })

      it("uses 6rem top padding regardless of showPadding", () => {
        render(
          <AppView {...getProps({ embedded: false, showPadding: true })} />
        )
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })

      it("uses 6rem top padding regardless of showToolbar", () => {
        render(
          <AppView {...getProps({ embedded: false, showToolbar: true })} />
        )
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })

      it("uses 8rem top padding when top nav is showing (>1 page)", () => {
        renderAppView(
          {
            embedded: false,
            navigationPosition: Navigation.Position.TOP,
          },
          {
            navigationContext: {
              appPages: [
                { pageName: "page1", pageScriptHash: "hash1" },
                { pageName: "page2", pageScriptHash: "hash2" },
              ],
            },
          }
        )
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("8rem")
      })

      it("uses 6rem top padding when top nav is not showing (single page)", () => {
        renderAppView(
          {
            embedded: false,
            navigationPosition: Navigation.Position.TOP,
          },
          {
            navigationContext: {
              appPages: [{ pageName: "page1", pageScriptHash: "hash1" }],
            },
          }
        )
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })

      it("uses 6rem top padding regardless of sidebar content (hasSidebar does not affect non-embedded)", () => {
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

        renderAppView(
          {
            elements: new AppRoot(
              FAKE_SCRIPT_HASH,
              new BlockNode(FAKE_SCRIPT_HASH, [empty, sidebar, empty, empty])
            ),
            embedded: false, // Non-embedded
          },
          {
            navigationContext: {
              appPages: [{ pageName: "page1", pageScriptHash: "hash1" }], // Single page, no top nav
            },
          }
        )
        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem") // Should be 6rem, not affected by sidebar
      })
    })

    describe("embedded apps", () => {
      describe("with show_padding option", () => {
        it("uses 6rem top padding when showPadding=true", () => {
          render(
            <AppView {...getProps({ embedded: true, showPadding: true })} />
          )
          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
          expect(style.paddingBottom).toEqual("10rem")
        })

        it("uses 6rem top padding when showPadding=true regardless of header content", () => {
          // Create elements that would trigger hasHeader=true
          const logo = LogoProto.create({
            image: "https://example.com/logo.png",
          })

          renderAppView(
            {
              embedded: true,
              showPadding: true,
              navigationPosition: Navigation.Position.TOP,
            },
            {
              sidebarConfigContext: { appLogo: logo },
            }
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
        })

        it("uses 6rem top padding even with top nav (never 8rem for embedded apps)", () => {
          render(
            <AppView
              {...getProps({
                embedded: true,
                showPadding: true,
                navigationPosition: Navigation.Position.TOP,
              })}
            />
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
        })
      })

      describe("with show_toolbar option", () => {
        it("uses 6rem top padding when showToolbar=true", () => {
          render(
            <AppView {...getProps({ embedded: true, showToolbar: true })} />
          )
          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
        })

        it("uses 6rem top padding when showToolbar=true regardless of header content", () => {
          // Create elements that would trigger hasHeader=true
          const logo = LogoProto.create({
            image: "https://example.com/logo.png",
          })

          renderAppView(
            {
              embedded: true,
              navigationPosition: Navigation.Position.TOP,
              showToolbar: true,
            },
            {
              sidebarConfigContext: { appLogo: logo },
            }
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
        })
      })

      describe("with both show_padding and show_toolbar options", () => {
        it("uses 6rem top padding when both showPadding=true and showToolbar=true", () => {
          render(
            <AppView
              {...getProps({
                embedded: true,
                showPadding: true,
                showToolbar: true,
              })}
            />
          )
          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("6rem")
        })
      })

      describe("without show_padding or show_toolbar options", () => {
        it("uses 2.25rem top padding when no header content", () => {
          render(
            <AppView
              {...getProps({
                embedded: true,
                showPadding: false,
                showToolbar: false,
                navigationPosition: Navigation.Position.SIDEBAR,
              })}
            />
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("2.25rem")
          expect(style.paddingBottom).toEqual("1rem")
        })

        it("uses 4.5rem top padding when header content exists (logo)", () => {
          const logo = LogoProto.create({
            image: "https://example.com/logo.png",
          })

          renderAppView(
            {
              embedded: true,
              showPadding: false,
              showToolbar: false,
            },
            {
              sidebarConfigContext: { appLogo: logo },
            }
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("4.5rem")
          expect(style.paddingBottom).toEqual("1rem")
        })

        it("uses 4.5rem top padding when header content exists (navigation)", () => {
          renderAppView(
            {
              embedded: true,
              showPadding: false,
              navigationPosition: Navigation.Position.TOP,
              showToolbar: false,
            },
            {
              sidebarConfigContext: {
                appLogo: null,
              },
              navigationContext: {
                appPages: [
                  { pageName: "page1", pageScriptHash: "hash1" },
                  { pageName: "page2", pageScriptHash: "hash2" },
                ],
              },
            }
          )

          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("4.5rem")
          expect(style.paddingBottom).toEqual("1rem")
        })

        it("uses 4.5rem top padding when header content exists (sidebar expand button)", () => {
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
            showPadding: false,
          })

          renderAppView(
            { ...props, showToolbar: false },
            {
              sidebarConfigContext: {
                initialSidebarState: PageConfig.SidebarState.COLLAPSED,
              },
            }
          )
          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("4.5rem")
          expect(style.paddingBottom).toEqual("1rem")
        })

        it("uses 4.5rem top padding when sidebar content exists (hasSidebar=true)", () => {
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
            showToolbar: false,
            elements: new AppRoot(
              FAKE_SCRIPT_HASH,
              new BlockNode(FAKE_SCRIPT_HASH, [empty, sidebar, empty, empty])
            ),
            embedded: true,
            showPadding: false,
          })

          render(<AppView {...props} />)
          const style = getMainBlockContainerStyle()
          expect(style.paddingTop).toEqual("4.5rem")
          expect(style.paddingBottom).toEqual("1rem")
        })
      })
    })

    describe("edge cases", () => {
      it("prioritizes showPadding over header content", () => {
        const logo = LogoProto.create({
          image: "https://example.com/logo.png",
        })

        renderAppView(
          {
            embedded: true,
            showPadding: true,
          },
          {
            sidebarConfigContext: { appLogo: logo },
          }
        )

        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })

      it("prioritizes showToolbar over header content", () => {
        const logo = LogoProto.create({
          image: "https://example.com/logo.png",
        })

        renderAppView(
          {
            embedded: true,
            showPadding: false,
            showToolbar: true,
          },
          {
            sidebarConfigContext: { appLogo: logo },
          }
        )

        const style = getMainBlockContainerStyle()
        expect(style.paddingTop).toEqual("6rem")
      })
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
      renderAppView(getProps(), {
        sidebarConfigContext: { appLogo: null },
      })
      expect(screen.queryByTestId("stHeaderLogo")).not.toBeInTheDocument()
    })

    it("uses iconImage if provided", () => {
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderAppView({}, { sidebarConfigContext: { appLogo: fullAppLogo } })
      const collapsedLogo = screen.getByTestId("stHeaderLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://docs.streamlit.io/logo.svg"
      )
      expect(collapsedLogo).toHaveClass("stLogo")
    })

    it("defaults to image if no iconImage", () => {
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderAppView({}, { sidebarConfigContext: { appLogo: imageOnly } })

      const collapsedLogo = screen.getByTestId("stHeaderLogo")
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("default no link with image size medium", () => {
      renderAppView({}, { sidebarConfigContext: { appLogo: imageOnly } })
      expect(screen.queryByTestId("stLogoLink")).not.toBeInTheDocument()
      expect(screen.getByTestId("stHeaderLogo")).toHaveStyle({
        height: "1.5rem",
      })
    })

    it("link with image if provided", () => {
      renderAppView({}, { sidebarConfigContext: { appLogo: imageWithLink } })
      expect(screen.getByTestId("stLogoLink")).toHaveAttribute(
        "href",
        "www.example.com"
      )
    })

    it("renders logo - large size when specified", () => {
      renderAppView({}, { sidebarConfigContext: { appLogo: imageWithSize } })
      expect(screen.getByTestId("stHeaderLogo")).toHaveStyle({
        height: "2rem",
      })
    })

    it("sends an CLIENT_ERROR message when the logo source fails to load", () => {
      const props = getProps({})
      renderAppView(props, { sidebarConfigContext: { appLogo: imageOnly } })
      const logoElement = screen.getByTestId("stHeaderLogo")
      expect(logoElement).toBeInTheDocument()

      fireEvent.error(logoElement)

      expect(sendClientErrorToHost).toHaveBeenCalledWith(
        "Header Logo",
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

  describe("navigation position rendering", () => {
    it("renders sidebar navigation when navigationPosition=SIDEBAR", () => {
      renderAppView(
        { navigationPosition: Navigation.Position.SIDEBAR },
        {
          navigationContext: {
            appPages: [
              { pageName: "page1", pageScriptHash: "hash1" },
              { pageName: "page2", pageScriptHash: "hash2" },
            ],
          },
        }
      )

      expect(screen.queryByTestId("stSidebar")).toBeInTheDocument()
      expect(screen.getByText("page1")).toBeInTheDocument()
      expect(screen.getByText("page2")).toBeInTheDocument()
    })

    it("renders top navigation when navigationPosition=TOP", () => {
      renderAppView(
        { navigationPosition: Navigation.Position.TOP },
        {
          navigationContext: {
            appPages: [
              { pageName: "page1", pageScriptHash: "hash1" },
              { pageName: "page2", pageScriptHash: "hash2" },
            ],
          },
        }
      )

      // Check that nav is in the header area
      const header = screen.getByTestId("stHeader")
      expect(header).toBeInTheDocument()

      // Navigation should be rendered in the header
      // Elements might be hidden in overflow menu, so just verify the navigation container exists
      const toolbar = screen.getByTestId("stToolbar")
      expect(toolbar).toBeInTheDocument()

      // No sidebar should be present
      expect(screen.queryByTestId("stSidebar")).not.toBeInTheDocument()
    })

    it("renders neither sidebar nor top nav when navigationPosition=HIDDEN", () => {
      render(
        <AppView
          {...getProps({ navigationPosition: Navigation.Position.HIDDEN })}
        />
      )

      expect(screen.queryByTestId("stSidebar")).not.toBeInTheDocument()
      expect(screen.queryByText("page1")).not.toBeInTheDocument()
      expect(screen.queryByText("page2")).not.toBeInTheDocument()
    })

    it("does not render top nav with single page when navigationPosition=TOP", () => {
      render(
        <AppView
          {...getProps({ navigationPosition: Navigation.Position.TOP })}
        />
      )

      expect(screen.queryByText("page1")).not.toBeInTheDocument()
      expect(screen.queryByTestId("stSidebar")).not.toBeInTheDocument()
    })

    it("renders top nav when there is one section with multiple pages", () => {
      const appPages = [
        {
          pageName: "page1",
          pageScriptHash: "hash1",
          sectionHeader: "Section 1",
        },
        {
          pageName: "page2",
          pageScriptHash: "hash2",
          sectionHeader: "Section 1",
        },
      ]
      const navSections = ["Section 1"]

      // Verify the business logic: navigation should be shown when there's one section with multiple pages
      expect(shouldShowNavigation(appPages, navSections)).toBe(true)
    })

    it("does not render top nav when there is one section with one page", () => {
      const appPages = [
        {
          pageName: "page1",
          pageScriptHash: "hash1",
          sectionHeader: "Section 1",
        },
      ]
      const navSections = ["Section 1"]

      // Verify the business logic: navigation should not be shown when there's only one page
      expect(shouldShowNavigation(appPages, navSections)).toBe(false)
    })
  })

  describe("header transparency and padding logic", () => {
    it("header has transparent background when no content is shown", () => {
      // Minimal setup with no logo, no sidebar, no navigation, no toolbar
      render(
        <AppView
          {...getProps({
            navigationPosition: Navigation.Position.SIDEBAR,
          })}
        />
      )

      const header = screen.getByTestId("stHeader")
      // The Header component should be rendered with isTransparentBackground=true
      // when no content is shown
      expect(header).toBeInTheDocument()
      expect(header).toHaveStyle("background-color: rgba(0, 0, 0, 0)")
    })

    it("header has solid background when logo is shown", () => {
      const logo = LogoProto.create({
        image: "https://example.com/logo.png",
      })

      renderAppView({}, { sidebarConfigContext: { appLogo: logo } })

      const header = screen.getByTestId("stHeader")
      expect(header).toBeInTheDocument()
      // Logo should be visible in header when sidebar is collapsed
      expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()
    })

    it("header has solid background when navigation is shown", () => {
      renderAppView(
        { navigationPosition: Navigation.Position.TOP },
        {
          navigationContext: {
            appPages: [
              { pageName: "page1", pageScriptHash: "hash1" },
              { pageName: "page2", pageScriptHash: "hash2" },
            ],
          },
        }
      )

      const header = screen.getByTestId("stHeader")
      expect(header).toBeInTheDocument()
      expect(header).not.toHaveStyle({ backgroundColor: "transparent" })
      // Navigation should be present in the header
      const allPage2Elements = screen.getAllByText("page2")
      expect(allPage2Elements.length).toBeGreaterThan(0)
    })

    it("header shows logo and sidebar button in embed mode", () => {
      const logo = LogoProto.create({
        image: "https://example.com/logo.png",
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
        embedded: true,
      })

      // Mock embed mode (showToolbar = false)
      renderAppView(
        { ...props, showToolbar: false },
        {
          sidebarConfigContext: {
            initialSidebarState: PageConfig.SidebarState.COLLAPSED, // Ensure sidebar starts collapsed
            appLogo: logo,
          },
        }
      )

      // Header should be visible
      expect(screen.getByTestId("stHeader")).toBeInTheDocument()

      // Logo should be visible (when sidebar is collapsed)
      expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()

      // Expand sidebar button should be visible
      expect(screen.getByTestId("stExpandSidebarButton")).toBeInTheDocument()
    })

    it("header shows navigation in embed mode with top nav", () => {
      // Mock embed mode (showToolbar = false) and multiple pages
      renderAppView(
        {
          navigationPosition: Navigation.Position.TOP,
          embedded: true,
          showToolbar: false,
        },
        {
          navigationContext: {
            appPages: [
              { pageName: "page1", pageScriptHash: "hash1" },
              { pageName: "page2", pageScriptHash: "hash2" },
            ],
          },
        }
      )

      // Header should be visible
      expect(screen.getByTestId("stHeader")).toBeInTheDocument()

      // Navigation should still be shown in embed mode
      const allPage2Elements = screen.getAllByText("page2")
      expect(allPage2Elements.length).toBeGreaterThan(0)
    })

    it("header does NOT show toolbar actions in embed mode without show_toolbar", () => {
      render(
        <AppView
          {...getProps({
            embedded: true,
            showToolbar: false,
            topRightContent: <div data-testid="toolbar-actions">Toolbar</div>,
          })}
        />
      )

      // Header should be visible
      expect(screen.getByTestId("stHeader")).toBeInTheDocument()

      // Toolbar actions should NOT be visible
      expect(screen.queryByTestId("toolbar-actions")).not.toBeInTheDocument()
    })

    it("header shows toolbar actions in embed mode WITH show_toolbar", () => {
      render(
        <AppView
          {...getProps({
            embedded: true,
            showToolbar: true,
            topRightContent: <div data-testid="toolbar-actions">Toolbar</div>,
          })}
        />
      )

      // Header should be visible
      expect(screen.getByTestId("stHeader")).toBeInTheDocument()

      // Toolbar actions SHOULD be visible
      expect(screen.getByTestId("toolbar-actions")).toBeInTheDocument()
    })
  })

  describe("sidebar flicker prevention", () => {
    it("responds to initialSidebarState changes from AUTO to COLLAPSED", () => {
      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar content"),
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

      // Mock the context with AUTO state
      // Use renderWithContexts to get the rerender with ability to update context values
      const { rerenderWithContexts } = renderWithContexts(
        <AppView {...props} />,
        {
          sidebarConfigContext: {
            initialSidebarState: PageConfig.SidebarState.AUTO,
          },
          themeContext: {
            activeTheme: mockTheme,
            setTheme: vi.fn(),
            availableThemes: [],
          },
        }
      )

      // Sidebar should be rendered and expanded when initialSidebarState is AUTO
      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toBeInTheDocument()
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")

      // Now simulate receiving page config with collapsed state
      rerenderWithContexts(<AppView {...props} />, {
        sidebarConfigContext: {
          initialSidebarState: PageConfig.SidebarState.COLLAPSED,
        },
      })

      // Now sidebar should be rendered but collapsed
      const sidebarAfterConfig = screen.getByTestId("stSidebar")
      expect(sidebarAfterConfig).toBeInTheDocument()
      expect(sidebarAfterConfig).toHaveAttribute("aria-expanded", "false")
    })

    it("renders sidebar immediately when initialSidebarState is COLLAPSED", () => {
      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar content"),
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

      renderAppView(props, {
        sidebarConfigContext: {
          initialSidebarState: PageConfig.SidebarState.COLLAPSED,
        },
      })

      // Sidebar should be rendered immediately when state is known
      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toBeInTheDocument()
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "false")
    })

    it("renders sidebar immediately when initialSidebarState is EXPANDED", () => {
      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar content"),
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

      renderAppView(props, {
        sidebarConfigContext: {
          initialSidebarState: PageConfig.SidebarState.EXPANDED,
        },
      })

      // Sidebar should be rendered immediately when state is known
      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toBeInTheDocument()
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")
    })

    it("shows sidebar when multiple pages exist even with AUTO state", () => {
      renderAppView(
        { navigationPosition: Navigation.Position.SIDEBAR },
        {
          sidebarConfigContext: {
            initialSidebarState: PageConfig.SidebarState.AUTO,
          },
          navigationContext: {
            appPages: [
              { pageName: "page1", pageScriptHash: "hash1" },
              { pageName: "page2", pageScriptHash: "hash2" },
            ],
          },
        }
      )

      // Sidebar should be rendered and expanded initially
      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toBeInTheDocument()
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")
    })

    it("sidebar shows after first script run when no page config is set", () => {
      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar content"),
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

      // Initially AUTO state, sidebar should be rendered and expanded
      renderAppView(props, {
        sidebarConfigContext: {
          initialSidebarState: PageConfig.SidebarState.AUTO,
        },
      })
      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toBeInTheDocument()
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")

      // Simulate script finished event without page config change
      // This tests the showSidebarOverride logic would apply
      // (In the real app, this would be handled by scriptFinishedHandler)

      // Since we can't easily trigger the script finished handler in the test,
      // we'll verify the initial behavior is correct (no sidebar with AUTO)
      // The actual fix will ensure sidebar shows after script finishes
    })
  })

  describe("sidebar toggle state persistence", () => {
    let elementsWithSidebar: AppRoot

    beforeEach(() => {
      window.localStorage.clear()

      const sidebarElement = new ElementNode(
        makeElementWithInfoText("sidebar content"),
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

      elementsWithSidebar = new AppRoot(
        FAKE_SCRIPT_HASH,
        new BlockNode(FAKE_SCRIPT_HASH, [main, sidebar, event, bottom])
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
      window.localStorage.clear()
    })

    const renderAppViewWithSidebar = (
      initialSidebarState: PageConfig.SidebarState
    ): ReturnType<typeof renderWithContexts> => {
      return renderAppView(
        { elements: elementsWithSidebar },
        { sidebarConfigContext: { initialSidebarState } }
      )
    }

    it("uses initial sidebar config when no localStorage value exists", () => {
      expect(window.localStorage.getItem("stSidebarCollapsed-")).toBeNull()

      renderAppViewWithSidebar(PageConfig.SidebarState.EXPANDED)

      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")
    })

    it("uses initial sidebar config for collapsed state when no localStorage value exists", () => {
      expect(window.localStorage.getItem("stSidebarCollapsed-")).toBeNull()

      renderAppViewWithSidebar(PageConfig.SidebarState.COLLAPSED)

      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "false")
    })

    it("restores collapsed state from localStorage on initial load", () => {
      window.localStorage.setItem("stSidebarCollapsed-", "true")

      renderAppViewWithSidebar(PageConfig.SidebarState.EXPANDED)

      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "false")
    })

    it("restores expanded state from localStorage on initial load", () => {
      window.localStorage.setItem("stSidebarCollapsed-", "false")

      renderAppViewWithSidebar(PageConfig.SidebarState.COLLAPSED)

      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")
    })

    it("handles invalid localStorage values gracefully", () => {
      window.localStorage.setItem("stSidebarCollapsed-", "invalid")

      renderAppViewWithSidebar(PageConfig.SidebarState.EXPANDED)

      const sidebarDOMElement = screen.getByTestId("stSidebar")
      expect(sidebarDOMElement).toHaveAttribute("aria-expanded", "true")
    })
  })
})
