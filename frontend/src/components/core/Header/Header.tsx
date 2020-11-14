import React, { ReactElement, ReactNode } from "react"
import PageLayoutContext from "components/core/PageLayoutContext"
import {
  StyledHeader,
  StyledHeaderDecoration,
  StyledHeaderToolbar,
} from "./styled-components"

export interface HeaderProps {
  children: ReactNode
}

function Header({ children }: HeaderProps): ReactElement {
  const { wideMode, embedded } = React.useContext(PageLayoutContext)

  return (
    <StyledHeader
      isWideMode={wideMode}
      isEmbedded={embedded}
      // The tabindex below is required for testing.
      tabIndex={-1}
    >
      <StyledHeaderDecoration data-testid="stDecoration" />
      <StyledHeaderToolbar data-testid="stToolbar">
        {children}
      </StyledHeaderToolbar>
    </StyledHeader>
  )
}

export default Header
