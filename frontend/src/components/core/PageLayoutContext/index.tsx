import React from "react"
import { PageConfig } from "autogen/proto"

export default React.createContext({
  wideMode: false,
  layout: PageConfig.Layout.CENTERED,
  initialSidebarState: PageConfig.SidebarState.AUTO,
  embedded: false,
  isFullScreen: false,
  setFullScreen: (value: boolean) => {},
  addReportFinshedHandler: (func: () => void) => {},
  removeReportFinshedHandler: (func: () => void) => {},
})
