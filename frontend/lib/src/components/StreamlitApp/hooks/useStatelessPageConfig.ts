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

import { useEffect } from "react"
import {
  PageConfigLayout,
  type PageConfig,
  PageConfigSideBarState,
} from "../stores/PageConfigContext"
import { type MessageQueue } from "../lib/MessageQueue"
import { PageConfig as PageConfigProto } from "../../../proto"

function getPageConfigLayoutFromProto(
  layout: PageConfigProto.Layout
): PageConfigLayout {
  if (layout === PageConfigProto.Layout.WIDE) {
    return PageConfigLayout.WIDE
  }

  return PageConfigLayout.CENTERED
}

function getPageConfigSidebarStateFromProto(
  state: PageConfigProto.SidebarState
): PageConfigSideBarState {
  switch (state) {
    case PageConfigProto.SidebarState.EXPANDED:
      return PageConfigSideBarState.EXPANDED
    case PageConfigProto.SidebarState.COLLAPSED:
      return PageConfigSideBarState.COLLAPSED
    default:
      return PageConfigSideBarState.AUTO
  }
}

export function useStatelessPageConfig(
  messageQueue: MessageQueue,
  pageConfig: PageConfig | undefined,
  onPageConfigChange: ((pageConfig: PageConfig) => void) | undefined
): PageConfig {
  useEffect(() => {
    return messageQueue.on<PageConfigProto>(
      "pageConfigChanged",
      pageConfigProto => {
        if (!onPageConfigChange) {
          // No point in doing all this work if the callback isn't set.
          return
        }

        const { title, favicon, layout, initialSidebarState, menuItems } =
          pageConfigProto
        const newPageConfig: PageConfig = {
          layout: getPageConfigLayoutFromProto(layout),
          initialSidebarState:
            getPageConfigSidebarStateFromProto(initialSidebarState),
        }

        if (title) {
          newPageConfig.title = title
        }

        if (favicon) {
          newPageConfig.favicon = favicon
        }

        if (menuItems) {
          newPageConfig.menuItems = {
            getHelpUrl: menuItems.getHelpUrl ?? undefined,
            hideGetHelp: menuItems.hideGetHelp ?? undefined,
            reportABugUrl: menuItems.reportABugUrl ?? undefined,
            hideReportABug: menuItems.hideReportABug ?? undefined,
            aboutSectionMd: menuItems.aboutSectionMd ?? undefined,
          }
        }

        onPageConfigChange(newPageConfig)
      }
    )
  }, [messageQueue, onPageConfigChange])

  return (
    pageConfig ?? {
      layout: PageConfigLayout.CENTERED,
      initialSidebarState: PageConfigSideBarState.AUTO,
    }
  )
}
