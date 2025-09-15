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

import React, { MouseEvent, ReactElement } from "react"

import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"
import { DynamicIcon, isMaterialIcon, useEmotionTheme } from "@streamlit/lib"

import {
  StyledSidebarLinkText,
  StyledSidebarNavIcon,
  StyledSidebarNavLink,
  StyledSidebarNavLinkContainer,
} from "./styled-components"

export interface SidebarNavLinkProps {
  isActive: boolean
  pageUrl: string
  icon: string | undefined | null
  onClick: (e: MouseEvent) => void
  isTopNav?: boolean
  isInDropdown?: boolean
  children: string
}

const SidebarNavLink = ({
  isActive,
  pageUrl,
  icon,
  onClick,
  isTopNav,
  isInDropdown,
  children,
}: SidebarNavLinkProps): ReactElement => {
  const theme = useEmotionTheme()
  // If connection state not connected, or host has disabled inputs,
  // disable sidebar nav links
  const { widgetsDisabled: disableSidebarNavLinks } = useAppContext()

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

  return (
    <StyledSidebarNavLinkContainer
      disabled={disableSidebarNavLinks}
      data-testid={navLinkContainerTestId}
    >
      <StyledSidebarNavLink
        data-testid={navLinkTestId}
        isActive={isActive}
        disabled={disableSidebarNavLinks}
        href={pageUrl}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
      >
        {icon?.length ? (
          <StyledSidebarNavIcon isActive={isActive}>
            <DynamicIcon
              size="base"
              iconValue={icon}
              color={
                !isActive && isMaterialIcon(icon)
                  ? // Apply color with opacity on material icons
                    // But we don't want to apply opacity on emoji icons
                    theme.colors.fadedText60
                  : theme.colors.bodyText
              }
            />
          </StyledSidebarNavIcon>
        ) : null}
        <StyledSidebarLinkText
          isActive={isActive}
          disabled={disableSidebarNavLinks}
          isTopNav={isTopNav}
          label={children}
        >
          {children}
        </StyledSidebarLinkText>
      </StyledSidebarNavLink>
    </StyledSidebarNavLinkContainer>
  )
}

export default SidebarNavLink
