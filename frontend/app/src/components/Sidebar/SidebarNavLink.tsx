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

import { useTheme } from "@emotion/react"
import { transparentize } from "color2k"

import { DynamicIcon, EmotionTheme, isMaterialIcon } from "@streamlit/lib"

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
  children: string
}

const SidebarNavLink = ({
  isActive,
  pageUrl,
  icon,
  onClick,
  children,
}: SidebarNavLinkProps): ReactElement => {
  const theme: EmotionTheme = useTheme()
  return (
    <StyledSidebarNavLinkContainer>
      <StyledSidebarNavLink
        data-testid="stSidebarNavLink"
        isActive={isActive}
        href={pageUrl}
        onClick={onClick}
      >
        {icon?.length ? (
          <StyledSidebarNavIcon isActive={isActive}>
            <DynamicIcon
              size="md"
              iconValue={icon}
              color={
                !isActive && isMaterialIcon(icon)
                  ? // Apply color with opacity on material icons
                    // But we don't want to apply opacity on emoji icons
                    transparentize(theme.colors.bodyText, 0.5)
                  : theme.colors.bodyText
              }
            />
          </StyledSidebarNavIcon>
        ) : null}
        <StyledSidebarLinkText isActive={isActive}>
          {children}
        </StyledSidebarLinkText>
      </StyledSidebarNavLink>
    </StyledSidebarNavLinkContainer>
  )
}

export default SidebarNavLink
