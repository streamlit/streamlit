import React from "react"

import { PageConfig } from "src/autogen/proto"
import { baseTheme, ThemeConfig } from "src/theme"
import { BaseUriParts, getWindowBaseUriParts } from "src/lib/UriUtil"

export interface Props {
  wideMode: boolean
  layout: PageConfig.Layout
  initialSidebarState: PageConfig.SidebarState
  embedded: boolean
  isFullScreen: boolean
  setFullScreen: (value: boolean) => void
  addScriptFinishedHandler: (func: () => void) => void
  removeScriptFinishedHandler: (func: () => void) => void
  activeTheme: ThemeConfig
  setTheme: (theme: ThemeConfig) => void
  availableThemes: ThemeConfig[]
  addThemes: (themes: ThemeConfig[]) => void
  sidebarChevronDownshift: number
  getBaseUriParts: () => BaseUriParts | undefined
}

export default React.createContext<Props>({
  wideMode: false,
  layout: PageConfig.Layout.CENTERED,
  initialSidebarState: PageConfig.SidebarState.AUTO,
  embedded: false,
  isFullScreen: false,
  setFullScreen: (value: boolean) => {},
  addScriptFinishedHandler: (func: () => void) => {},
  removeScriptFinishedHandler: (func: () => void) => {},
  activeTheme: baseTheme,
  setTheme: (theme: ThemeConfig) => {},
  availableThemes: [],
  addThemes: (themes: ThemeConfig[]) => {},
  sidebarChevronDownshift: 0,
  getBaseUriParts: getWindowBaseUriParts,
})
