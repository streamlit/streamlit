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

import React, {
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import EventContainer from "@streamlit/app/src/components/EventContainer"
import Header from "@streamlit/app/src/components/Header"
import { LogoComponent } from "@streamlit/app/src/components/Logo"
import {
  shouldShowNavigation,
  TopNav,
} from "@streamlit/app/src/components/Navigation"
import ThemedSidebar from "@streamlit/app/src/components/Sidebar"
import {
  getSavedSidebarState,
  saveSidebarState,
  shouldCollapse,
} from "@streamlit/app/src/components/Sidebar/utils"
import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"
import { StreamlitEndpoints } from "@streamlit/connection"
import {
  AppRoot,
  BlockNode,
  ContainerContentsWrapper,
  FileUploadClient,
  IGuestToHostMessage,
  LibContext,
  Profiler,
  useExecuteWhenChanged,
  useWindowDimensionsContext,
  WidgetStateManager,
} from "@streamlit/lib"
import { IAppPage, Logo, Navigation } from "@streamlit/protobuf"

import ScrollToBottomContainer from "./ScrollToBottomContainer"
import {
  StyledAppViewBlockContainer,
  StyledAppViewBlockSpacer,
  StyledAppViewContainer,
  StyledAppViewMain,
  StyledBottomBlockContainer,
  StyledEventBlockContainer,
  StyledIFrameResizerAnchor,
  StyledInnerBottomContainer,
  StyledMainContent,
  StyledSidebarBlockContainer,
  StyledStickyBottomContainer,
} from "./styled-components"

export interface AppViewProps {
  elements: AppRoot

  endpoints: StreamlitEndpoints

  sendMessageToHost: (message: IGuestToHostMessage) => void

  widgetMgr: WidgetStateManager

  uploadClient: FileUploadClient

  appPages: IAppPage[]

  navSections: string[]

  onPageChange: (pageName: string) => void

  hideSidebarNav: boolean

  expandSidebarNav: boolean

  navigationPosition: Navigation.Position

  topRightContent?: React.ReactNode

  pageLinkBaseUrl?: string

  wideMode: boolean

  appLogo: Logo | null

  embedded: boolean

  showPadding: boolean

  disableScrolling: boolean

  currentPageScriptHash: string
}

/**
 * Renders a Streamlit app.
 */
function AppView(props: AppViewProps): ReactElement {
  const {
    elements,
    widgetMgr,
    uploadClient,
    appLogo,
    appPages,
    navSections,
    onPageChange,
    expandSidebarNav,
    hideSidebarNav,
    sendMessageToHost,
    endpoints,
    navigationPosition,
    topRightContent,
    pageLinkBaseUrl = "",
    wideMode,
    embedded,
    showPadding,
    disableScrolling,
    currentPageScriptHash,
  } = props

  useEffect(() => {
    const listener = (): void => {
      sendMessageToHost({
        type: "UPDATE_HASH",
        hash: window.location.hash,
      })
    }
    window.addEventListener("hashchange", listener, false)
    return () => window.removeEventListener("hashchange", listener, false)
  }, [sendMessageToHost])

  const { initialSidebarState, widgetsDisabled, showToolbar } = useAppContext()

  const {
    addScriptFinishedHandler,
    removeScriptFinishedHandler,
    activeTheme,
  } = useContext(LibContext)

  const { innerWidth } = useWindowDimensionsContext()

  const layout = wideMode ? "wide" : "narrow"
  const hasSidebarElements = !elements.sidebar.isEmpty
  const hasEventElements = !elements.event.isEmpty
  const hasBottomElements = !elements.bottom.isEmpty

  const [showSidebarOverride, setShowSidebarOverride] = useState(false)

  const showSidebar =
    innerWidth > 0 &&
    (hasSidebarElements ||
      (navigationPosition === Navigation.Position.SIDEBAR &&
        !hideSidebarNav &&
        appPages.length > 1) ||
      showSidebarOverride)

  useEffect(() => {
    // Handle sidebar flicker/unmount with MPA & hideSidebarNav
    if (showSidebar && hideSidebarNav && !showSidebarOverride) {
      setShowSidebarOverride(true)
    }
  }, [showSidebar, hideSidebarNav, showSidebarOverride])

  const scriptFinishedHandler = useCallback(() => {
    // Check at end of script run if no sidebar elements
    if (!hasSidebarElements && showSidebarOverride) {
      setShowSidebarOverride(false)
    }
  }, [hasSidebarElements, showSidebarOverride])

  useEffect(() => {
    addScriptFinishedHandler(scriptFinishedHandler)
    return () => {
      removeScriptFinishedHandler(scriptFinishedHandler)
    }
  }, [
    scriptFinishedHandler,
    addScriptFinishedHandler,
    removeScriptFinishedHandler,
  ])

  // Activate scroll to bottom whenever there are bottom elements:
  const Component = hasBottomElements
    ? ScrollToBottomContainer
    : StyledAppViewMain

  const renderBlock = (node: BlockNode): ReactElement => (
    <ContainerContentsWrapper
      node={node}
      endpoints={endpoints}
      widgetMgr={widgetMgr}
      widgetsDisabled={widgetsDisabled}
      uploadClient={uploadClient}
      height="auto"
    />
  )

  const [isSidebarCollapsed, setSidebarIsCollapsed] = useState<boolean>(() => {
    const savedSidebarState = getSavedSidebarState(pageLinkBaseUrl)
    if (savedSidebarState !== null) {
      // User has adjusted the sidebar, respect it
      return savedSidebarState
    }

    // No saved preference, use initial config + screen size logic
    return shouldCollapse(
      initialSidebarState,
      parseInt(activeTheme.emotion.breakpoints.md, 10),
      innerWidth
    )
  })

  useExecuteWhenChanged(() => {
    if (innerWidth > 0 && showSidebar) {
      const savedSidebarState = getSavedSidebarState(pageLinkBaseUrl)

      if (savedSidebarState !== null) {
        // User has adjusted the sidebar, respect it
        setSidebarIsCollapsed(savedSidebarState)
      } else {
        setSidebarIsCollapsed(
          shouldCollapse(
            initialSidebarState,
            parseInt(activeTheme.emotion.breakpoints.md, 10),
            innerWidth
          )
        )
      }
    }
  }, [
    innerWidth,
    showSidebar,
    initialSidebarState,
    activeTheme.emotion.breakpoints.md,
    pageLinkBaseUrl,
  ])

  const setSidebarCollapsedWithOptionalPersistence = useCallback(
    (isCollapsed: boolean, shouldPersist: boolean = true) => {
      setSidebarIsCollapsed(isCollapsed)
      if (shouldPersist) {
        saveSidebarState(pageLinkBaseUrl, isCollapsed)
      }
    },
    [pageLinkBaseUrl]
  )

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedWithOptionalPersistence(!isSidebarCollapsed, true)
  }, [setSidebarCollapsedWithOptionalPersistence, isSidebarCollapsed])

  // logo component to be used in the header when sidebar is closed
  const logoElement = appLogo ? (
    <LogoComponent
      appLogo={appLogo}
      endpoints={endpoints}
      collapsed={isSidebarCollapsed || !showSidebar}
      componentName="Header Logo"
      dataTestId="stHeaderLogo"
    />
  ) : null

  // Determine if the header should have transparent background
  // Only transparent when no content is shown at all
  const shouldShowLogo = logoElement && (!showSidebar || isSidebarCollapsed)
  const shouldShowExpandButton = showSidebar && isSidebarCollapsed
  const shouldShowTopNav =
    navigationPosition === Navigation.Position.TOP &&
    shouldShowNavigation(appPages, navSections)

  const hasHeaderUserContent =
    shouldShowLogo || shouldShowExpandButton || shouldShowTopNav || showToolbar

  // The tabindex is required to support scrolling by arrow keys.
  return (
    <>
      <StyledAppViewContainer
        className="stAppViewContainer appview-container"
        data-testid="stAppViewContainer"
        data-layout={layout}
      >
        {showSidebar && (
          <Profiler id="Sidebar">
            <ThemedSidebar
              endpoints={endpoints}
              appLogo={appLogo}
              appPages={appPages}
              navSections={navSections}
              hasElements={hasSidebarElements}
              onPageChange={onPageChange}
              currentPageScriptHash={currentPageScriptHash}
              hideSidebarNav={hideSidebarNav}
              expandSidebarNav={expandSidebarNav}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={setSidebarCollapsedWithOptionalPersistence}
            >
              <StyledSidebarBlockContainer>
                {renderBlock(elements.sidebar)}
              </StyledSidebarBlockContainer>
            </ThemedSidebar>
          </Profiler>
        )}
        <StyledMainContent>
          <Header
            hasSidebar={showSidebar}
            isSidebarOpen={showSidebar && !isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            navigation={
              navigationPosition === Navigation.Position.TOP &&
              shouldShowNavigation(appPages, navSections) ? (
                <TopNav
                  endpoints={endpoints}
                  pageLinkBaseUrl={pageLinkBaseUrl}
                  currentPageScriptHash={currentPageScriptHash}
                  appPages={appPages}
                  onPageChange={onPageChange}
                />
              ) : null
            }
            rightContent={topRightContent}
            logoComponent={logoElement}
          />
          <Component
            tabIndex={0}
            isEmbedded={embedded}
            disableScrolling={disableScrolling}
            className="stMain"
            data-testid="stMain"
          >
            <Profiler id="Main">
              <StyledAppViewBlockContainer
                className="stMainBlockContainer block-container"
                data-testid="stMainBlockContainer"
                isWideMode={wideMode}
                showPadding={showPadding}
                hasBottom={hasBottomElements}
                hasHeader={hasHeaderUserContent}
                hasSidebar={showSidebar}
                showToolbar={showToolbar}
                hasTopNav={shouldShowTopNav}
                embedded={embedded}
              >
                {renderBlock(elements.main)}
              </StyledAppViewBlockContainer>
            </Profiler>
            {/* Anchor indicates to the iframe resizer that this is the lowest
        possible point to determine height. But we don't add an anchor if there is
        a bottom container in the app, since those two aspects don't work
        well together. */}
            {!hasBottomElements && (
              <StyledIFrameResizerAnchor
                data-testid="stAppIframeResizerAnchor"
                data-iframe-height
              />
            )}
            {hasBottomElements && (
              <Profiler id="Bottom">
                {/* We add spacing here to make sure that the sticky bottom is
           always pinned the bottom. Using sticky layout here instead of
           absolute / fixed is a trick to automatically account for the bottom
           height in the scroll area. Thereby, the bottom container will never
           cover something if you scroll to the end.*/}
                <StyledAppViewBlockSpacer />
                <StyledStickyBottomContainer
                  className="stBottom"
                  data-testid="stBottom"
                >
                  <StyledInnerBottomContainer>
                    <StyledBottomBlockContainer
                      data-testid="stBottomBlockContainer"
                      isWideMode={wideMode}
                      showPadding={showPadding}
                    >
                      {renderBlock(elements.bottom)}
                    </StyledBottomBlockContainer>
                  </StyledInnerBottomContainer>
                </StyledStickyBottomContainer>
              </Profiler>
            )}
          </Component>
        </StyledMainContent>
        {hasEventElements && (
          <Profiler id="Event">
            <EventContainer>
              <StyledEventBlockContainer
                className="stEvent"
                data-testid="stEvent"
              >
                {renderBlock(elements.event)}
              </StyledEventBlockContainer>
            </EventContainer>
          </Profiler>
        )}
      </StyledAppViewContainer>
    </>
  )
}

export default AppView
