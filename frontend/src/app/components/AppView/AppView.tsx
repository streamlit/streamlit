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

import React, { ReactElement } from "react"
import { IAppPage } from "src/lib/proto"

import VerticalBlock from "src/lib/components/core/Block"
import { ThemedSidebar } from "src/app/components/Sidebar"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { FormsData, WidgetStateManager } from "src/lib/WidgetStateManager"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { ComponentRegistry } from "src/lib/components/widgets/CustomComponent"

import { AppContext } from "src/app/components/AppContext"
import { BlockNode, AppRoot } from "src/lib/AppNode"
import { SessionInfo } from "src/lib/SessionInfo"
import { IGuestToHostMessage } from "src/lib/hostComm/types"
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"

import {
  StyledAppViewBlockContainer,
  StyledAppViewContainer,
  StyledAppViewFooter,
  StyledAppViewFooterLink,
  StyledAppViewMain,
  StyledIFrameResizerAnchor,
  StyledAppViewBlockSpacer,
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

  // TODO: This works for scroll to bottom, but we will need
  // to revisit this when we support multiple position options
  const containsChatInput =
    Array.from(elements.main.getElements()).find(element => {
      return element.type === "chatInput"
    }) !== undefined
  const Component = containsChatInput
    ? ScrollToBottomContainer
    : StyledAppViewMain

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
    showFooter,
    showToolbar,
    showColoredLine,
  } = React.useContext(AppContext)
  const renderBlock = (node: BlockNode): ReactElement => (
    <StyledAppViewBlockContainer
      className="block-container"
      data-testid="block-container"
      isWideMode={wideMode}
      showPadding={showPadding}
      addPaddingForHeader={showToolbar || showColoredLine}
    >
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
    </StyledAppViewBlockContainer>
  )

  const layout = wideMode ? "wide" : "narrow"
  const hasSidebarElements = !elements.sidebar.isEmpty
  const showSidebar =
    hasSidebarElements || (!hideSidebarNav && appPages.length > 1)

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
          {renderBlock(elements.sidebar)}
        </ThemedSidebar>
      )}
      <Component
        tabIndex={0}
        isEmbedded={embedded}
        disableScrolling={disableScrolling}
        className="main"
      >
        {renderBlock(elements.main)}
        {/* Anchor indicates to the iframe resizer that this is the lowest
        possible point to determine height */}
        <StyledIFrameResizerAnchor
          hasFooter={!embedded || showFooter}
          data-iframe-height
        />
        {/* Spacer fills up dead space to ensure the footer remains at the
        bottom of the page in larger views */}
        {(!embedded || showFooter) && (
          <StyledAppViewBlockSpacer data-testid="AppViewBlockSpacer" />
        )}
        {(!embedded || showFooter) && !containsChatInput && (
          <StyledAppViewFooter isWideMode={wideMode}>
            Made with{" "}
            <StyledAppViewFooterLink href="//streamlit.io" target="_blank">
              Streamlit
            </StyledAppViewFooterLink>
          </StyledAppViewFooter>
        )}
      </Component>
    </StyledAppViewContainer>
  )
}

export default AppView
