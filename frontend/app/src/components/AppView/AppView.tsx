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

import React, { ReactElement } from "react"

import {
  IAppPage,
  VerticalBlock,
  ScriptRunState,
  FormsData,
  WidgetStateManager,
  FileUploadClient,
  ComponentRegistry,
  BlockNode,
  AppRoot,
  SessionInfo,
  IGuestToHostMessage,
  StreamlitEndpoints,
  LibContext,
} from "@streamlit/lib"

import { ThemedSidebar } from "@streamlit/app/src/components/Sidebar"
import EventContainer from "@streamlit/app/src/components/EventContainer"

import { AppContext } from "@streamlit/app/src/components/AppContext"

import {
  StyledAppViewBlockContainer,
  StyledAppViewContainer,
  StyledAppViewMain,
  StyledIFrameResizerAnchor,
  StyledEventBlockContainer,
  StyledInnerBottomContainer,
  StyledStickyBottomContainer,
  StyledAppViewBlockSpacer,
  StyledSidebarBlockContainer,
  StyledBottomBlockContainer,
} from "./styled-components"
import ScrollToBottomContainer from "./ScrollToBottomContainer"

export interface AppViewProps {
  elements: AppRoot

  endpoints: StreamlitEndpoints

  sessionInfo: SessionInfo

  sendMessageToHost: (message: IGuestToHostMessage) => void

  // The unique ID for the most recent script run.
  scriptRunId: string

  scriptRunState: ScriptRunState

  widgetMgr: WidgetStateManager

  uploadClient: FileUploadClient

  // Disable the widgets when not connected to the server.
  widgetsDisabled: boolean

  componentRegistry: ComponentRegistry

  formsData: FormsData

  appPages: IAppPage[]

  onPageChange: (pageName: string) => void

  currentPageScriptHash: string

  hideSidebarNav: boolean
}

/**
 * Renders a Streamlit app.
 */
function AppView(props: AppViewProps): ReactElement {
  const {
    elements,
    sessionInfo,
    scriptRunId,
    scriptRunState,
    widgetMgr,
    widgetsDisabled,
    uploadClient,
    componentRegistry,
    formsData,
    appPages,
    onPageChange,
    currentPageScriptHash,
    hideSidebarNav,
    sendMessageToHost,
    endpoints,
  } = props

  React.useEffect(() => {
    const listener = (): void => {
      sendMessageToHost({
        type: "UPDATE_HASH",
        hash: window.location.hash,
      })
    }
    window.addEventListener("hashchange", listener, false)
    return () => window.removeEventListener("hashchange", listener, false)
  }, [sendMessageToHost])

  const {
    wideMode,
    initialSidebarState,
    embedded,
    showPadding,
    disableScrolling,
    showToolbar,
    showColoredLine,
    toastAdjustment,
  } = React.useContext(AppContext)

  const { addScriptFinishedHandler, removeScriptFinishedHandler } =
    React.useContext(LibContext)

  const layout = wideMode ? "wide" : "narrow"
  const hasSidebarElements = !elements.sidebar.isEmpty
  const hasEventElements = !elements.event.isEmpty
  const hasBottomElements = !elements.bottom.isEmpty

  const [showSidebarOverride, setShowSidebarOverride] = React.useState(false)
  const showSidebar =
    hasSidebarElements ||
    (!hideSidebarNav && appPages.length > 1) ||
    showSidebarOverride

  React.useEffect(() => {
    // Handle sidebar flicker/unmount with MPA & hideSidebarNav
    if (showSidebar && hideSidebarNav && !showSidebarOverride) {
      setShowSidebarOverride(true)
    }
  }, [showSidebar, hideSidebarNav, showSidebarOverride])

  const scriptFinishedHandler = React.useCallback(() => {
    // Check at end of script run if no sidebar elements
    if (!hasSidebarElements && showSidebarOverride) {
      setShowSidebarOverride(false)
    }
  }, [hasSidebarElements, showSidebarOverride])

  React.useEffect(() => {
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
    <VerticalBlock
      node={node}
      endpoints={endpoints}
      sessionInfo={sessionInfo}
      scriptRunId={scriptRunId}
      scriptRunState={scriptRunState}
      widgetMgr={widgetMgr}
      widgetsDisabled={widgetsDisabled}
      uploadClient={uploadClient}
      componentRegistry={componentRegistry}
      formsData={formsData}
    />
  )

  // The tabindex is required to support scrolling by arrow keys.
  return (
    <StyledAppViewContainer
      className="appview-container"
      data-testid="stAppViewContainer"
      data-layout={layout}
    >
      {showSidebar && (
        <ThemedSidebar
          endpoints={endpoints}
          initialSidebarState={initialSidebarState}
          appPages={appPages}
          hasElements={hasSidebarElements}
          onPageChange={onPageChange}
          currentPageScriptHash={currentPageScriptHash}
          hideSidebarNav={hideSidebarNav}
        >
          <StyledSidebarBlockContainer>
            {renderBlock(elements.sidebar)}
          </StyledSidebarBlockContainer>
        </ThemedSidebar>
      )}
      <Component
        tabIndex={0}
        isEmbedded={embedded}
        disableScrolling={disableScrolling}
        className="main"
      >
        <StyledAppViewBlockContainer
          className="block-container"
          data-testid="stAppViewBlockContainer"
          isWideMode={wideMode}
          showPadding={showPadding}
          addPaddingForHeader={showToolbar || showColoredLine}
          hasBottom={hasBottomElements}
          isEmbedded={embedded}
          hasSidebar={showSidebar}
        >
          {renderBlock(elements.main)}
        </StyledAppViewBlockContainer>
        {/* Anchor indicates to the iframe resizer that this is the lowest
        possible point to determine height. But we don't add an anchor if there is
        a bottom container in the app, since those two aspects don't work
        well together. */}
        {!hasBottomElements && (
          <StyledIFrameResizerAnchor
            data-testid="IframeResizerAnchor"
            data-iframe-height
          />
        )}
        {hasBottomElements && (
          <>
            {/* We add spacing here to make sure that the sticky bottom is
           always pinned the bottom. Using sticky layout here instead of
           absolut / fixed is a trick to automatically account for the bottom
           height in the scroll area. Thereby, the bottom container will never
           cover something if you scroll to the end.*/}
            <StyledAppViewBlockSpacer />
            <StyledStickyBottomContainer data-testid="stBottom">
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
          </>
        )}
      </Component>
      {hasEventElements && (
        <EventContainer
          toastAdjustment={toastAdjustment}
          scriptRunId={elements.event.scriptRunId}
        >
          <StyledEventBlockContainer>
            {renderBlock(elements.event)}
          </StyledEventBlockContainer>
        </EventContainer>
      )}
    </StyledAppViewContainer>
  )
}

export default AppView
