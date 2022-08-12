import React, { ReactElement } from "react"
import AppContext from "src/components/core/AppContext"
import ThemeProvider from "src/components/core/ThemeProvider"
import { createTheme, ThemeConfig } from "src/theme"
import Sidebar, { SidebarProps } from "./Sidebar"

const createSidebarTheme = (theme: ThemeConfig): ThemeConfig =>
  createTheme(
    "Sidebar",
    {
      secondaryBackgroundColor: theme.emotion.colors.bgColor,
      backgroundColor: theme.emotion.colors.secondaryBg,
    },
    theme,
    // inSidebar
    true
  )

const ThemedSidebar = ({
  children,
  ...sidebarProps
}: Omit<SidebarProps, "chevronDownshift" | "theme">): ReactElement => {
  const {
    activeTheme,
    sidebarChevronDownshift: chevronDownshift,
  } = React.useContext(AppContext)
  const sidebarTheme = createSidebarTheme(activeTheme)

  return (
    <ThemeProvider
      theme={sidebarTheme.emotion}
      baseuiTheme={sidebarTheme.basewebTheme}
    >
      <Sidebar {...sidebarProps} chevronDownshift={chevronDownshift}>
        {children}
      </Sidebar>
    </ThemeProvider>
  )
}

export default ThemedSidebar
