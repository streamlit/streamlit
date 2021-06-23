/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, ReactNode } from "react"

import PageLayoutContext from "src/components/core/PageLayoutContext"
import ThemeProvider from "src/components/core/ThemeProvider"

import { StyledCard } from "./styled-components"

interface CardProps {
  children: ReactNode
}

const Card = ({ children }: CardProps): ReactElement => {
  const { activeSecondaryTheme } = React.useContext(PageLayoutContext)
  return (
    <ThemeProvider
      theme={activeSecondaryTheme.emotion}
      baseuiTheme={activeSecondaryTheme.basewebTheme}
    >
      <StyledCard data-testid="stCard">{children}</StyledCard>
    </ThemeProvider>
  )
}

export default Card
