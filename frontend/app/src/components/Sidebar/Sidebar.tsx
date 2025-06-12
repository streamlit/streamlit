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
  useRef,
  useState,
} from "react"

import { ChevronLeft, ChevronRight } from "@emotion-icons/material-outlined"
import { getLogger } from "loglevel"
import {
  NumberSize,
  Resizable,
  ResizeCallback,
  ResizeDirection,
} from "re-resizable"

import { StreamlitEndpoints } from "@streamlit/connection"
import {
  BaseButton,
  BaseButtonKind,
  Icon,
  isColoredLineDisplayed,
  isEmbed,
  IsSidebarContext,
  LibContext,
  useEmotionTheme,
} from "@streamlit/lib"
import { PageConfig } from "@streamlit/protobuf"
import { localStorageAvailable } from "@streamlit/utils"
import { shouldCollapse } from "@streamlit/app/src/components/Sidebar/utils"
import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"

import {
  RESIZE_HANDLE_WIDTH,
  StyledCollapseSidebarButton,
  StyledLogo,
  StyledLogoLink,
  StyledNoLogoSpacer,
  StyledOpenSidebarButton,
  StyledResizeHandle,
  StyledSidebar,
  StyledSidebarContent,
  StyledSidebarHeaderContainer,
  StyledSidebarOpenContainer,
  StyledSidebarUserContent,
} from "./styled-components"
import SidebarNav from "./SidebarNav"

export interface SidebarProps {
  endpoints: StreamlitEndpoints
  chevronDownshift: number
  children?: ReactElement
  initialSidebarState?: PageConfig.SidebarState
  hasElements: boolean
}

const DEFAULT_WIDTH = "256"

const LOG = getLogger("Sidebar")

function calculateMaxBreakpoint(value: string): number {
  // We subtract a margin of 0.02 to use as a max-width
  return parseInt(value, 10) - 0.02
}

function headerDecorationVisible(): boolean {
  // Additional safeguard for sidebar height sizing
  let coloredLineExists = false
  const headerDecoration = document.getElementById("stDecoration")
  if (headerDecoration) {
    const decorationStyles = window.getComputedStyle(headerDecoration)
    coloredLineExists =
      decorationStyles.visibility !== "hidden" &&
      decorationStyles.visibility !== "collapse" &&
      decorationStyles.display !== "none"
  }
  return coloredLineExists
}

const Sidebar: React.FC<SidebarProps> = ({
  endpoints,
  chevronDownshift,
  children,
  initialSidebarState,
  hasElements,
}) => {
  const theme = useEmotionTheme()
  const mediumBreakpointPx = calculateMaxBreakpoint(theme.breakpoints.md)
  const sideBarInitiallyCollapsed = shouldCollapse(
    initialSidebarState,
    mediumBreakpointPx
  )

  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizableRef = useRef<Resizable>(null)

  const cachedSidebarWidth = localStorageAvailable()
    ? window.localStorage.getItem("sidebarWidth")
    : undefined

  const [collapsedSidebar, setCollapsedSidebar] = useState<boolean>(
    sideBarInitiallyCollapsed
  )
  const [sidebarWidth, setSidebarWidth] = useState<string>(
    cachedSidebarWidth || DEFAULT_WIDTH
  )
  const [lastInnerWidth, setLastInnerWidth] = useState<number>(
    window ? window.innerWidth : Infinity
  )

  const { activeTheme } = useContext(LibContext)
  const { hideSidebarNav, appPages, appLogo } = useAppContext()

  useEffect(() => {
    setCollapsedSidebar(
      shouldCollapse(initialSidebarState, mediumBreakpointPx)
    )
    // hasElements is included because we want to check if the
    // sidebar should be collapsed when it changes.
  }, [initialSidebarState, hasElements, mediumBreakpointPx])

  // When hovering sidebar header
  const [showSidebarCollapse, setShowSidebarCollapse] =
    useState<boolean>(false)

  const onMouseOver = useCallback(() => {
    setShowSidebarCollapse(true)
  }, [])

  const onMouseOut = useCallback(() => {
    setShowSidebarCollapse(false)
  }, [])

  const initializeSidebarWidth = useCallback((width: number): void => {
    const newWidth = width.toString()

    setSidebarWidth(newWidth)

    if (localStorageAvailable()) {
      window.localStorage.setItem("sidebarWidth", newWidth)
    }
  }, [])

  const onResizeStop = useCallback<ResizeCallback>(
    (
      _e: MouseEvent | TouchEvent,
      _direction: ResizeDirection,
      ref: HTMLElement,
      _d: NumberSize
    ) => {
      // Use the actual ref width, not the delta, to avoid stale delta values
      if (ref) {
        const newWidth = ref.clientWidth || ref.offsetWidth
        initializeSidebarWidth(newWidth)
      }
    },
    [initializeSidebarWidth]
  )

  useEffect(() => {
    const checkMobileOnResize = (): boolean => {
      if (!window) return false

      const { innerWidth } = window

      // Collapse the sidebar if the window was narrowed and is now mobile-sized
      if (innerWidth < lastInnerWidth && innerWidth <= mediumBreakpointPx) {
        setCollapsedSidebar(true)
      }
      setLastInnerWidth(innerWidth)

      return true
    }

    const handleClickOutside = (event: MouseEvent): void => {
      if (sidebarRef && window) {
        const { current } = sidebarRef
        const { innerWidth } = window

        if (
          current &&
          !current.contains(event.target as Node) &&
          innerWidth <= mediumBreakpointPx
        ) {
          setCollapsedSidebar(true)
        }
      }
    }

    window.addEventListener("resize", checkMobileOnResize)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      window.removeEventListener("resize", checkMobileOnResize)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [lastInnerWidth, mediumBreakpointPx])

  function resetSidebarWidth(): void {
    // Double clicking on the resize handle resets sidebar to default width
    setSidebarWidth(DEFAULT_WIDTH)
    if (localStorageAvailable()) {
      window.localStorage.setItem("sidebarWidth", DEFAULT_WIDTH)
    }
  }

  const toggleCollapse = useCallback(() => {
    setCollapsedSidebar(!collapsedSidebar)
  }, [collapsedSidebar])

  const handleLogoError = (logoUrl: string, collapsed: boolean): void => {
    // StyledLogo does not retain the e.currentEvent.src like other onerror cases
    // store and read from ref instead
    const component = collapsed ? "Logo" : "Sidebar Logo"
    LOG.error(`Client Error: ${component} source error - ${logoUrl}`)
    endpoints.sendClientErrorToHost(
      component,
      "Logo source failed to load",
      "onerror triggered",
      logoUrl
    )
  }

  function renderLogo(collapsed: boolean): ReactElement {
    if (!appLogo) {
      return <StyledNoLogoSpacer data-testid="stLogoSpacer" />
    }

    const displayImage =
      collapsed && appLogo.iconImage ? appLogo.iconImage : appLogo.image
    const source = endpoints.buildMediaURL(displayImage)

    const logo = (
      <StyledLogo
        src={source}
        size={appLogo.size}
        sidebarWidth={sidebarWidth}
        alt="Logo"
        className="stLogo"
        data-testid={collapsed ? "stHeaderLogo" : "stSidebarLogo"}
        // Save to logo's src to send on load error
        onError={_ => handleLogoError(source, collapsed)}
      />
    )

    if (appLogo.link) {
      return (
        <StyledLogoLink
          href={appLogo.link}
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

  const hasPageNavAbove = appPages.length > 1 && !hideSidebarNav

  // Handles checking the URL params
  const isEmbedded = isEmbed() && !isColoredLineDisplayed()
  // If header decoration visible, move sidebar down so decoration doesn't go below it
  const sidebarAdjust = !isEmbedded && headerDecorationVisible()

  // The tabindex is required to support scrolling by arrow keys.
  return (
    <>
      <StyledSidebarOpenContainer
        chevronDownshift={chevronDownshift}
        data-testid="stSidebarCollapsedControl"
      >
        {renderLogo(true)}
        <StyledOpenSidebarButton
          theme={
            // Use the active theme from the LibContext to use the main theme
            // for styling the open button since otherwise it would use the colors
            // of the sidebar theme (which is not what we want here).
            activeTheme.emotion
          }
        >
          <BaseButton
            kind={BaseButtonKind.HEADER_NO_PADDING}
            onClick={toggleCollapse}
          >
            <Icon content={ChevronRight} size="xl" />
          </BaseButton>
        </StyledOpenSidebarButton>
      </StyledSidebarOpenContainer>
      <Resizable
        className="stSidebar"
        data-testid="stSidebar"
        aria-expanded={!collapsedSidebar}
        enable={{
          top: false,
          right: true,
          bottom: false,
          left: false,
        }}
        handleStyles={{
          right: {
            width: RESIZE_HANDLE_WIDTH,
            right: "-6px",
          },
        }}
        handleComponent={{
          right: <StyledResizeHandle onDoubleClick={resetSidebarWidth} />,
        }}
        size={{
          width: sidebarWidth,
          height: "auto",
        }}
        ref={resizableRef}
        as={StyledSidebar}
        onResizeStop={onResizeStop}
        // Props part of StyledSidebar, but not Resizable component
        // @ts-expect-error
        isCollapsed={collapsedSidebar}
        adjustTop={sidebarAdjust}
        sidebarWidth={sidebarWidth}
      >
        <StyledSidebarContent
          data-testid="stSidebarContent"
          ref={sidebarRef}
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
          // Safari fix: hide scrollbars when not hovered. See globalStyles.ts
          className={"hideScrollbar"}
        >
          <StyledSidebarHeaderContainer data-testid="stSidebarHeader">
            {renderLogo(false)}
            <StyledCollapseSidebarButton
              showSidebarCollapse={showSidebarCollapse}
              data-testid="stSidebarCollapseButton"
            >
              <BaseButton
                kind={BaseButtonKind.HEADER_NO_PADDING}
                onClick={toggleCollapse}
              >
                <Icon content={ChevronLeft} size="xl" />
              </BaseButton>
            </StyledCollapseSidebarButton>
          </StyledSidebarHeaderContainer>
          {hasPageNavAbove && (
            <SidebarNav
              endpoints={endpoints}
              appPages={appPages}
              collapseSidebar={toggleCollapse}
              hasSidebarElements={hasElements}
            />
          )}
          <StyledSidebarUserContent
            hasPageNavAbove={hasPageNavAbove}
            data-testid="stSidebarUserContent"
          >
            {children}
          </StyledSidebarUserContent>
        </StyledSidebarContent>
      </Resizable>
    </>
  )
}

function SidebarWithProvider(props: SidebarProps): ReactElement {
  return (
    <IsSidebarContext.Provider value={true}>
      <Sidebar {...props} />
    </IsSidebarContext.Provider>
  )
}

export default SidebarWithProvider
