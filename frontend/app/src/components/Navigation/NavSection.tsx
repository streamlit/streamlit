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

import React, { ReactElement } from "react"

import { DynamicIcon } from "@streamlit/lib"

import {
  StyledChevronContainer,
  StyledNavSectionContainer,
  StyledNavSectionHeaderText,
  StyledSidebarNavSectionHeader,
} from "./styled-components"

export interface NavSectionProps {
  header?: string
  children: ReactElement[]
  isExpanded: boolean
  onToggle: () => void
}

const NavSection = ({
  header = "",
  children,
  isExpanded,
  onToggle,
}: NavSectionProps): ReactElement => {
  return (
    <StyledNavSectionContainer>
      {header && (
        <StyledSidebarNavSectionHeader
          data-testid="stNavSectionHeader"
          onClick={onToggle}
          isExpanded={isExpanded}
        >
          <StyledNavSectionHeaderText>{header}</StyledNavSectionHeaderText>
          <StyledChevronContainer isExpanded={isExpanded}>
            <DynamicIcon iconValue=":material/expand_more:" size="lg" />
          </StyledChevronContainer>
        </StyledSidebarNavSectionHeader>
      )}
      {isExpanded && children}
    </StyledNavSectionContainer>
  )
}

export default NavSection
