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

import React, { ReactElement, ReactNode } from "react"
import { AppContext } from "src/components/core/AppContext"
import {
  StyledHeader,
  StyledHeaderDecoration,
  StyledHeaderToolbar,
} from "./styled-components"

export interface HeaderProps {
  children: ReactNode
  isStale?: boolean
}

function Header({ isStale, children }: HeaderProps): ReactElement {
  const { wideMode, embedded, showToolbar, showColoredLine } =
    React.useContext(AppContext)

  let showHeader = true
  if (embedded) {
    showHeader = showToolbar || showColoredLine
  }
  return (
    <StyledHeader
      showHeader={showHeader}
      isWideMode={wideMode}
      // The tabindex below is required for testing.
      tabIndex={-1}
      isStale={isStale}
      data-testid="stHeader"
    >
      {showColoredLine && (
        <StyledHeaderDecoration data-testid="stDecoration" />
      )}
      {showToolbar && (
        <StyledHeaderToolbar data-testid="stToolbar">
          {children}
        </StyledHeaderToolbar>
      )}
    </StyledHeader>
  )
}

export default Header
