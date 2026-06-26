/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import Header from "@streamlit/app/src/components/Header/Header"
import LogoComponent from "@streamlit/app/src/components/Logo/LogoComponent"
import TopNav from "@streamlit/app/src/components/Navigation/TopNav"
import { shouldShowNavigation } from "@streamlit/app/src/components/Navigation/utils"
import ThemedSidebar from "@streamlit/app/src/components/Sidebar/ThemedSidebar"
import {
  calculateMaxBreakpoint,
  getSavedSidebarState,
  saveSidebarState,
  shouldCollapse,
} from "@streamlit/app/src/components/Sidebar/utils"
import { StreamlitEndpoints } from "@streamlit/connection"
import {
  AppNode,
  AppRoot,
  BlockNode,
  ComponentRegistry,
  ContainerContentsWrapper,
  ElementNode,
  FileUploadClient,
  IGuestToHostMessage,
  NavigationContext,
  Profiler,
  SidebarConfigContext,
  StreamlitToastItem,
  StyledToastRegion,
  ThemeContext,
  toastQueue,
  TransientNode,
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

/**
 * Recursively checks if the given node contains a chat input element.
 */
function containsChatInput(node: AppNode): boolean {
  if (node instanceof ElementNode) {
    return node.element.type === "chatInput"
  }

  if (node instanceof BlockNode) {
    return node.children.some(containsChatInput)
  }

  if (node instanceof TransientNode) {
    const anchorHasChatInput = node.anchor
      ? containsChatInput(node.anchor)
      : false
    const transientHasChatInput = node.transientNodes.some(
      el => el.element.type === "chatInput"
    )
    return anchorHasChatInput || transientHasChatInput
  }

  // Unknown AppNode subtypes are assumed to not contain a chat input.
  // Update this function if a new node type is added that could contain one.
  return false
}

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

  const { appPages, pageLinkBaseUrl } = useContext(NavigationContext)

  const { initialSidebarState, appLogo, hideSidebarNav, isSidebarLocked } =
    useContext(SidebarConfigContext)

  const { innerWidth } = useWindowDimensionsContext()

  // LOCKED is desktop-only: on mobile the sidebar renders as an overlay that
  // covers the main content, so the lock degrades gracefully — users can still
  // collapse it to access the page. innerWidth > 0 guards against the
  // unmeasured initial state before dimensions have been read from the DOM.
  const isMobileViewport =
    innerWidth > 0 &&
    innerWidth <= calculateMaxBreakpoint(activeTheme.emotion.breakpoints.md)
  const isEffectivelyLocked = isSidebarLocked && !isMobileViewport

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
        shouldShowNavigation(appPages)) ||
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

  // Activate scroll to bottom only when there's a chat input in the bottom container:
  const hasBottomChatInput = useMemo(
    () => hasBottomElements && containsChatInput(elements.bottom),
    [hasBottomElements, elements.bottom]
  )
  const Component = hasBottomChatInput
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
    // Locked sidebar (desktop only) always starts open; ignore saved preference.
    if (isEffectivelyLocked) {
      return false
    }

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
      // Locked sidebar (desktop only) always stays open; skip saved preference.
      if (isEffectivelyLocked) {
        setSidebarIsCollapsed(false)
        return
      }

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
    isEffectivelyLocked,
  ])

  const setSidebarCollapsedWithOptionalPersistence = useCallback(
    (isCollapsed: boolean, shouldPersist: boolean = true) => {
      // Locked sidebar (desktop only) cannot be collapsed; skip localStorage writes.
      if (isEffectivelyLocked) {
        return
      }
      setSidebarIsCollapsed(isCollapsed)
      if (shouldPersist) {
        saveSidebarState(pageLinkBaseUrl, isCollapsed)
      }
    },
    [isEffectivelyLocked, pageLinkBaseUrl]
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
    shouldShowNavigation(appPages)

  const hasHeaderUserContent =
    shouldShowLogo || shouldShowExpandButton || shouldShowTopNav || showToolbar

  // The tabindex is required to support scrolling by arrow keys.
  return (
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
            shouldShowNavigation(appPages) ? (
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
      <StyledToastRegion
        queue={toastQueue}
        aria-label="Notifications"
        data-testid="stToastContainer"
        className="stToastContainer"
      >
        {({ toast }) => <StreamlitToastItem toast={toast} />}
      </StyledToastRegion>
      {hasEventElements && (
        <Profiler id="Event">
          <StyledEventBlockContainer className="stEvent" data-testid="stEvent">
            {renderBlock(elements.event)}
          </StyledEventBlockContainer>
        </Profiler>
      )}
    </StyledAppViewContainer>
  )
}

export default AppView
