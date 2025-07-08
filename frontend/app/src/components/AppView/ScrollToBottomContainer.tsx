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

import React, { ReactElement, ReactNode } from "react"

import { useScrollToBottom } from "@streamlit/lib"

import { StyledAppViewMain } from "./styled-components"

export interface Props {
  className: string
  tabIndex: number
  isEmbedded: boolean
  disableScrolling: boolean
  children: ReactNode
}

export default function ScrollToBottomContainer(props: Props): ReactElement {
  const { className, tabIndex, children, isEmbedded, disableScrolling } = props
  const scrollContainerRef = useScrollToBottom(true)

  return (
    <StyledAppViewMain
      tabIndex={tabIndex}
      className={className}
      isEmbedded={isEmbedded}
      disableScrolling={disableScrolling}
      ref={scrollContainerRef}
      data-testid="stAppScrollToBottomContainer"
    >
      {children}
    </StyledAppViewMain>
  )
}
