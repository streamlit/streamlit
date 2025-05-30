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

import { getLogger } from "loglevel"

import { StreamlitEndpoints } from "@streamlit/connection"
import {
  AppRoot,
  BlockNode,
  ContainerContentsWrapper,
  FileUploadClient,
  IGuestToHostMessage,
  LibContext,
  Profiler,
  WidgetStateManager,
} from "@streamlit/lib"
import { Logo } from "@streamlit/protobuf"
import ThemedSidebar from "@streamlit/app/src/components/Sidebar"
import EventContainer from "@streamlit/app/src/components/EventContainer"
import {
  StyledLogo,
  StyledLogoLink,
  StyledSidebarOpenContainer,
} from "@streamlit/app/src/components/Sidebar/styled-components"
import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"

import {
  StyledAppViewBlockContainer,
  StyledAppViewBlockSpacer,
  StyledAppViewContainer,
  StyledAppViewMain,
  StyledBottomBlockContainer,
  StyledEventBlockContainer,
  StyledIFrameResizerAnchor,
  StyledInnerBottomContainer,
  StyledSidebarBlockContainer,
  StyledStickyBottomContainer,
} from "./styled-components"
import ScrollToBottomContainer from "./ScrollToBottomContainer"

const LOG = getLogger("AppView")
export interface AppViewProps {
  elements: AppRoot

  endpoints: StreamlitEndpoints

  sendMessageToHost: (message: IGuestToHostMessage) => void

  widgetMgr: WidgetStateManager

  uploadClient: FileUploadClient

  appLogo: Logo | null

  multiplePages: boolean

  wideMode: boolean

  embedded: boolean

  addPaddingForHeader: boolean

  showPadding: boolean

  disableScrolling: boolean

  hideSidebarNav: boolean
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
    multiplePages,
    wideMode,
    embedded,
    addPaddingForHeader,
    showPadding,
    disableScrolling,
    hideSidebarNav,
    sendMessageToHost,
    endpoints,
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

  const { initialSidebarState, sidebarChevronDownshift, widgetsDisabled } =
    useAppContext()

  const { addScriptFinishedHandler, removeScriptFinishedHandler } =
    useContext(LibContext)

  const layout = wideMode ? "wide" : "narrow"
  const hasSidebarElements = !elements.sidebar.isEmpty
  const hasEventElements = !elements.event.isEmpty
  const hasBottomElements = !elements.bottom.isEmpty

  const [showSidebarOverride, setShowSidebarOverride] = useState(false)

  const showSidebar =
    hasSidebarElements ||
    (!hideSidebarNav && multiplePages) ||
    showSidebarOverride

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

  const handleLogoError = (logoUrl: string): void => {
    // StyledLogo does not retain the e.currentEvent.src like other onerror cases
    // store and read from ref instead
    LOG.error(`Client Error: Logo source error - ${logoUrl}`)
    endpoints.sendClientErrorToHost(
      "Logo",
      "Logo source failed to load",
      "onerror triggered",
      logoUrl
    )
  }

  const renderLogo = (appLogoArg: Logo): ReactElement => {
    const displayImage = appLogoArg.iconImage
      ? appLogoArg.iconImage
      : appLogoArg.image
    const source = endpoints.buildMediaURL(displayImage)

    const logo = (
      <StyledLogo
        src={source}
        size={appLogoArg.size}
        alt="Logo"
        className="stLogo"
        data-testid="stHeaderLogo"
        // Save to logo's src to send on load error
        onError={_ => handleLogoError(source)}
      />
    )

    if (appLogoArg.link) {
      return (
        <StyledLogoLink
          href={appLogoArg.link}
          target="_blank"
          rel="noreferrer"
          data-testid="stLogoLink"
        >
          {logo}
        </StyledLogoLink>
      )
    }
    return logo
  }

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
    />
  )

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
            initialSidebarState={initialSidebarState}
            hasElements={hasSidebarElements}
          >
            <StyledSidebarBlockContainer>
              {renderBlock(elements.sidebar)}
            </StyledSidebarBlockContainer>
          </ThemedSidebar>
        </Profiler>
      )}
      {!showSidebar && appLogo && (
        <StyledSidebarOpenContainer
          chevronDownshift={sidebarChevronDownshift}
          data-testid="stSidebarCollapsedControl"
        >
          {renderLogo(appLogo)}
        </StyledSidebarOpenContainer>
      )}
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
            addPaddingForHeader={addPaddingForHeader}
            hasBottom={hasBottomElements}
            isEmbedded={embedded}
            hasSidebar={showSidebar}
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
  )
}

export default AppView
