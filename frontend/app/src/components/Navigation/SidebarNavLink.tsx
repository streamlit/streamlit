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

import { type MouseEvent, type ReactElement, useCallback } from "react"

import {
  DynamicIcon,
  isMaterialIcon,
  StreamlitMarkdown,
  useEmotionTheme,
} from "@streamlit/lib"

import {
  StyledSidebarLinkText,
  StyledSidebarNavIcon,
  StyledSidebarNavLink,
  StyledSidebarNavLinkContainer,
  StyledVisuallyHidden,
} from "./styled-components"

export interface SidebarNavLinkProps {
  isActive: boolean
  pageUrl: string
  icon: string | undefined | null
  onClick: (e: MouseEvent) => void
  isTopNav?: boolean
  isInDropdown?: boolean
  children: string
  widgetsDisabled: boolean
  isExternal?: boolean
  externalUrl?: string | null
  /** Roving tabindex for top-nav dropdown menu keyboard navigation. */
  menuTabIndex?: number
  /**
   * Receives the anchor element so top-nav dropdown menus can move focus
   * between items.
   */
  setItemRef?: (index: number, element: HTMLAnchorElement | null) => void
  /** Index passed to setItemRef for top-nav dropdown menus. */
  itemIndex?: number
}

const SidebarNavLink = ({
  isActive,
  pageUrl,
  icon,
  onClick,
  isTopNav,
  isInDropdown,
  children,
  widgetsDisabled,
  isExternal,
  externalUrl,
  menuTabIndex,
  setItemRef,
  itemIndex,
}: SidebarNavLinkProps): ReactElement => {
  const theme = useEmotionTheme()
  // If connection state not connected, or host has disabled inputs,
  // disable sidebar nav links
  const disableSidebarNavLinks = widgetsDisabled

  // Determine the appropriate test ID based on context
  let navLinkTestId: string
  if (isTopNav && isInDropdown) {
    navLinkTestId = "stTopNavDropdownLink"
  } else if (isTopNav) {
    navLinkTestId = "stTopNavLink"
  } else {
    navLinkTestId = "stSidebarNavLink"
  }
  const navLinkContainerTestId = isTopNav
    ? "stTopNavLinkContainer"
    : "stSidebarNavLinkContainer"

  // External pages can never be the current page
  const effectiveIsActive = isExternal ? false : isActive

  const setAnchorRef = useCallback(
    (element: HTMLAnchorElement | null): void => {
      if (setItemRef && itemIndex !== undefined) {
        setItemRef(itemIndex, element)
      }
    },
    [setItemRef, itemIndex]
  )

  return (
    <StyledSidebarNavLinkContainer
      disabled={disableSidebarNavLinks}
      data-testid={navLinkContainerTestId}
    >
      <StyledSidebarNavLink
        ref={setAnchorRef}
        data-testid={navLinkTestId}
        isActive={effectiveIsActive}
        disabled={disableSidebarNavLinks}
        isInDropdown={isInDropdown}
        href={isExternal ? (externalUrl ?? pageUrl) : pageUrl}
        onClick={onClick}
        aria-current={effectiveIsActive ? "page" : undefined}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        role={isInDropdown ? "menuitem" : undefined}
        tabIndex={isInDropdown ? menuTabIndex : undefined}
      >
        {icon?.length ? (
          <StyledSidebarNavIcon isActive={effectiveIsActive}>
            <DynamicIcon
              size="base"
              iconValue={icon}
              color={
                !effectiveIsActive && isMaterialIcon(icon)
                  ? // Apply color with opacity on material icons
                    // But we don't want to apply opacity on emoji icons
                    theme.colors.fadedText60
                  : theme.colors.bodyText
              }
            />
          </StyledSidebarNavIcon>
        ) : null}
        <StyledSidebarLinkText
          isActive={effectiveIsActive}
          disabled={disableSidebarNavLinks}
          isTopNav={isTopNav}
          label={children}
        >
          <StreamlitMarkdown
            source={children}
            allowHTML={false}
            isLabel
            disableLinks
            truncate
            inheritFont
          />
        </StyledSidebarLinkText>
        {isExternal && (
          <StyledVisuallyHidden>(opens in new tab)</StyledVisuallyHidden>
        )}
      </StyledSidebarNavLink>
    </StyledSidebarNavLinkContainer>
  )
}

export default SidebarNavLink
