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
import { StreamlitEndpoints } from "@streamlit/connection"
import {
  AppRoot,
  BlockNode,
  ComponentRegistry,
  ContainerContentsWrapper,
  FileUploadClient,
  IGuestToHostMessage,
  NavigationContext,
  Profiler,
  SidebarConfigContext,
  ThemeContext,
  useExecuteWhenChanged,
  useWindowDimensionsContext,
  WidgetStateManager,
} from "@streamlit/lib"
import { Navigation } from "@streamlit/protobuf"

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

  navigationPosition: Navigation.Position

  topRightContent?: React.ReactNode

  wideMode: boolean

  embedded: boolean

  showPadding: boolean

  disableScrolling: boolean

  addScriptFinishedHandler: (func: () => void) => void

  removeScriptFinishedHandler: (func: () => void) => void

  widgetsDisabled: boolean

  showToolbar: boolean

  disableFullscreenMode?: boolean

  componentRegistry: ComponentRegistry
}

/**
 * Renders a Streamlit app.
 */
function AppView(props: AppViewProps): ReactElement {
  const {
    elements,
    widgetMgr,
    uploadClient,
    sendMessageToHost,
    endpoints,
    navigationPosition,
    topRightContent,
    wideMode,
    embedded,
    showPadding,
    disableScrolling,
    addScriptFinishedHandler,
    removeScriptFinishedHandler,
    widgetsDisabled,
    showToolbar,
    disableFullscreenMode,
    componentRegistry,
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

  const { activeTheme } = useContext(ThemeContext)

  const { appPages, navSections, pageLinkBaseUrl } =
    useContext(NavigationContext)

  const { initialSidebarState, appLogo, hideSidebarNav } = useContext(
    SidebarConfigContext
  )

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
      disableFullscreenMode={disableFullscreenMode}
      componentRegistry={componentRegistry}
      height="auto"
      isRoot={true}
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
              hasElements={hasSidebarElements}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={setSidebarCollapsedWithOptionalPersistence}
              widgetsDisabled={widgetsDisabled}
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
                  widgetsDisabled={widgetsDisabled}
                />
              ) : null
            }
            rightContent={topRightContent}
            logoComponent={logoElement}
            showToolbar={showToolbar}
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
