import React, { ReactElement, ReactNode } from "react"
import AppContext from "src/components/core/AppContext"
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
  const { wideMode, embedded } = React.useContext(AppContext)

  return (
    <StyledHeader
      isWideMode={wideMode}
      isEmbedded={embedded}
      // The tabindex below is required for testing.
      tabIndex={-1}
      isStale={isStale}
      data-testid="stHeader"
    >
      <StyledHeaderDecoration data-testid="stDecoration" />
      <StyledHeaderToolbar data-testid="stToolbar">
        {children}
      </StyledHeaderToolbar>
    </StyledHeader>
  )
}

export default Header
