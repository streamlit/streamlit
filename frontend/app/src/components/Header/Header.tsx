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

import React, { ReactElement, ReactNode, useContext } from "react"

import { useAppContext } from "@streamlit/app/src/components/StreamlitContextProvider"
import {
  BaseButton,
  BaseButtonKind,
  DynamicIcon,
  LibContext,
} from "@streamlit/lib"

import {
  StyledHeader,
  StyledHeaderContent,
  StyledHeaderLeftSection,
  StyledHeaderRightSection,
  StyledHeaderToolbar,
  StyledLogoContainer,
  StyledOpenSidebarButton,
} from "./styled-components"

export interface HeaderProps {
  hasSidebar: boolean
  isSidebarOpen: boolean
  onToggleSidebar(): void
  navigation?: ReactNode
  rightContent?: ReactNode
  logoComponent?: ReactNode
}

const Header = ({
  hasSidebar,
  isSidebarOpen,
  onToggleSidebar,
  navigation,
  rightContent,
  logoComponent,
}: HeaderProps): ReactElement => {
  const { showToolbar } = useAppContext()
  const { activeTheme } = useContext(LibContext)

  const shouldShowLogo = logoComponent && !isSidebarOpen
  const shouldShowExpandButton = hasSidebar && !isSidebarOpen

  // Determine what content should be shown
  // When showToolbar is false (embed=true without show_toolbar), we still show
  // logo, sidebar icon, and navigation, but hide rightContent
  const shouldShowRightContent = showToolbar && rightContent

  // Check if there's any content to display at all
  const hasAnyContent =
    shouldShowLogo ||
    shouldShowExpandButton ||
    navigation ||
    shouldShowRightContent

  return (
    <StyledHeader
      className="stAppHeader"
      data-testid="stHeader"
      isTransparentBackground={!hasAnyContent}
    >
      {hasAnyContent ? (
        <StyledHeaderToolbar
          className="stAppToolbar"
          data-testid="stToolbar"
          theme={activeTheme.emotion}
        >
          <StyledHeaderContent>
            <StyledHeaderLeftSection>
              {shouldShowLogo ? (
                <StyledLogoContainer>{logoComponent}</StyledLogoContainer>
              ) : null}
              {shouldShowExpandButton && (
                <StyledOpenSidebarButton>
                  <BaseButton
                    kind={BaseButtonKind.HEADER_NO_PADDING}
                    onClick={onToggleSidebar}
                    data-testid="stExpandSidebarButton"
                  >
                    <DynamicIcon
                      size="xl"
                      iconValue={":material/keyboard_double_arrow_right:"}
                      color={activeTheme.emotion.colors.fadedText60}
                    />
                  </BaseButton>
                </StyledOpenSidebarButton>
              )}
            </StyledHeaderLeftSection>
            {navigation}
            {shouldShowRightContent ? (
              <StyledHeaderRightSection>
                {rightContent}
              </StyledHeaderRightSection>
            ) : null}
          </StyledHeaderContent>
        </StyledHeaderToolbar>
      ) : null}
    </StyledHeader>
  )
}

export default Header
