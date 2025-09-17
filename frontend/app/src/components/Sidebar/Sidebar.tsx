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
  useEffect,
  useRef,
  useState,
} from "react"

import {
  NumberSize,
  Resizable,
  ResizeCallback,
  ResizeDirection,
} from "re-resizable"

import { LogoComponent } from "@streamlit/app/src/components/Logo"
import {
  shouldShowNavigation,
  SidebarNav,
} from "@streamlit/app/src/components/Navigation"
import { StreamlitEndpoints } from "@streamlit/connection"
import {
  BaseButton,
  BaseButtonKind,
  DynamicIcon,
  IsSidebarContext,
  useEmotionTheme,
  useExecuteWhenChanged,
  useScrollbarGutterSize,
  useWindowDimensionsContext,
} from "@streamlit/lib"
import { IAppPage, Logo } from "@streamlit/protobuf"
import { localStorageAvailable } from "@streamlit/utils"

import {
  RESIZE_HANDLE_WIDTH,
  StyledCollapseSidebarButton,
  StyledNoLogoSpacer,
  StyledResizeHandle,
  StyledSidebar,
  StyledSidebarContent,
  StyledSidebarHeaderContainer,
  StyledSidebarUserContent,
} from "./styled-components"

export interface SidebarProps {
  endpoints: StreamlitEndpoints
  children?: ReactElement
  hasElements: boolean
  appLogo: Logo | null
  appPages: IAppPage[]
  navSections: string[]
  onPageChange: (pageName: string) => void
  currentPageScriptHash: string
  hideSidebarNav: boolean
  expandSidebarNav: boolean
  isCollapsed: boolean
  onToggleCollapse: (collapsed: boolean, shouldPersist?: boolean) => void
}

const DEFAULT_WIDTH = "256"

function calculateMaxBreakpoint(value: string): number {
  // We subtract a margin of 0.02 to use as a max-width
  return parseInt(value, 10) - 0.02
}

const Sidebar: React.FC<SidebarProps> = ({
  appLogo,
  endpoints,
  appPages,
  children,
  hasElements,
  onPageChange,
  currentPageScriptHash,
  hideSidebarNav,
  expandSidebarNav,
  navSections,
  isCollapsed,
  onToggleCollapse,
}): ReactElement => {
  const theme = useEmotionTheme()
  const mediumBreakpointPx = calculateMaxBreakpoint(theme.breakpoints.md)
  const { innerWidth } = useWindowDimensionsContext()
  const scrollbarGutterSize = useScrollbarGutterSize()

  const sidebarRef = useRef<HTMLDivElement>(null)

  const cachedSidebarWidth = localStorageAvailable()
    ? window.localStorage.getItem("sidebarWidth")
    : undefined

  const [sidebarWidth, setSidebarWidth] = useState<string>(
    cachedSidebarWidth || DEFAULT_WIDTH
  )
  const [lastInnerWidth, setLastInnerWidth] = useState<number>(
    innerWidth ?? Infinity
  )

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
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
        const newWidth = ref.clientWidth || ref.offsetWidth
        initializeSidebarWidth(newWidth)
      }
    },
    [initializeSidebarWidth]
  )

  useExecuteWhenChanged(() => {
    // Collapse the sidebar if the window was narrowed and is now mobile-sized
    if (innerWidth < lastInnerWidth && innerWidth <= mediumBreakpointPx) {
      if (!isCollapsed) {
        onToggleCollapse(true, false)
      }
    }
    setLastInnerWidth(innerWidth)
  }, [innerWidth])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (sidebarRef && window) {
        const { current } = sidebarRef

        if (
          current &&
          !current.contains(event.target as Node | null) &&
          innerWidth <= mediumBreakpointPx
        ) {
          if (!isCollapsed) {
            onToggleCollapse(true)
          }
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [
    lastInnerWidth,
    mediumBreakpointPx,
    isCollapsed,
    onToggleCollapse,
    innerWidth,
  ])

  function resetSidebarWidth(): void {
    // Double clicking on the resize handle resets sidebar to default width
    setSidebarWidth(DEFAULT_WIDTH)
    if (localStorageAvailable()) {
      window.localStorage.setItem("sidebarWidth", DEFAULT_WIDTH)
    }
  }

  const toggleCollapse = useCallback(() => {
    onToggleCollapse(!isCollapsed)
  }, [isCollapsed, onToggleCollapse])

  // Render logo or spacer - using shared LogoComponent
  const renderLogoContent = (): ReactElement | undefined => {
    if (!appLogo) {
      return <StyledNoLogoSpacer data-testid="stLogoSpacer" />
    }

    return (
      <LogoComponent
        appLogo={appLogo}
        endpoints={endpoints}
        collapsed={isCollapsed}
        componentName="Sidebar Logo"
        dataTestId="stSidebarLogo"
      />
    )
  }

  const hasPageNavAbove =
    shouldShowNavigation(appPages, navSections) && !hideSidebarNav

  // The tabindex is required to support scrolling by arrow keys.
  return (
    <Resizable
      className="stSidebar"
      data-testid="stSidebar"
      aria-expanded={!isCollapsed}
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
      as={StyledSidebar}
      onResizeStop={onResizeStop}
      // Props part of StyledSidebar, but not Resizable component
      // @ts-expect-error
      isCollapsed={isCollapsed}
      sidebarWidth={sidebarWidth}
      windowInnerWidth={innerWidth}
    >
      <StyledSidebarContent
        data-testid="stSidebarContent"
        ref={sidebarRef}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        scrollbarGutterSize={scrollbarGutterSize}
      >
        <StyledSidebarHeaderContainer data-testid="stSidebarHeader">
          {renderLogoContent()}
          <StyledCollapseSidebarButton
            showSidebarCollapse={showSidebarCollapse}
            data-testid="stSidebarCollapseButton"
          >
            <BaseButton
              kind={BaseButtonKind.HEADER_NO_PADDING}
              onClick={toggleCollapse}
            >
              <DynamicIcon
                size="xl"
                iconValue={":material/keyboard_double_arrow_left:"}
                color={theme.colors.fadedText60}
              />
            </BaseButton>
          </StyledCollapseSidebarButton>
        </StyledSidebarHeaderContainer>
        {hasPageNavAbove && (
          <SidebarNav
            endpoints={endpoints}
            appPages={appPages}
            collapseSidebar={toggleCollapse}
            currentPageScriptHash={currentPageScriptHash}
            hasSidebarElements={hasElements}
            expandSidebarNav={expandSidebarNav}
            onPageChange={onPageChange}
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
