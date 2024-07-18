/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import { useTheme } from "@emotion/react"
import { DownloadButton as DownloadButtonProto } from "@streamlit/lib/src/proto"
import BaseButton, {
  BaseButtonTooltip,
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { StreamlitEndpoints } from "@streamlit/lib/src/StreamlitEndpoints"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import { EmotionTheme } from "@streamlit/lib/src/theme"

export interface Props {
  endpoints: StreamlitEndpoints
  disabled: boolean
  element: DownloadButtonProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

export function createDownloadLink(
  endpoints: StreamlitEndpoints,
  url: string,
  enforceDownloadInNewTab: boolean
): HTMLAnchorElement {
  const link = document.createElement("a")
  const uri = endpoints.buildMediaURL(url)
  link.setAttribute("href", uri)
  if (enforceDownloadInNewTab) {
    link.setAttribute("target", "_blank")
  } else {
    link.setAttribute("target", "_self")
  }
  link.setAttribute("download", "")
  return link
}

function DownloadButton(props: Props): ReactElement {
  const { colors }: EmotionTheme = useTheme()
  const { disabled, element, widgetMgr, width, endpoints, fragmentId } = props
  const style = { width }
  const {
    libConfig: { enforceDownloadInNewTab = false }, // Default to false, if no libConfig, e.g. for tests
  } = React.useContext(LibContext)

  const kind =
    element.type === "primary"
      ? BaseButtonKind.PRIMARY
      : BaseButtonKind.SECONDARY

  const handleDownloadClick: () => void = () => {
    // Downloads are only done on links, so create a hidden one and click it
    // for the user.
    widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
    const link = createDownloadLink(
      endpoints,
      element.url,
      enforceDownloadInNewTab
    )
    link.click()
  }

  // When useContainerWidth true & has help tooltip,
  // we need to pass the container width down to the button
  const fluidWidth = element.help ? width : true

  return (
    <div
      className="row-widget stDownloadButton"
      data-testid="stDownloadButton"
      style={style}
    >
      <BaseButtonTooltip help={element.help}>
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled}
          onClick={handleDownloadClick}
          fluidWidth={element.useContainerWidth ? fluidWidth : false}
        >
          {element.icon && (
            <DynamicIcon
              size="lg"
              margin="0 sm 0 0"
              color={colors.bodyText}
              iconValue={element.icon}
            />
          )}
          <StreamlitMarkdown
            source={element.label}
            allowHTML={false}
            isLabel
            largerLabel
            disableLinks
          />
        </BaseButton>
      </BaseButtonTooltip>
    </div>
  )
}

export default DownloadButton
