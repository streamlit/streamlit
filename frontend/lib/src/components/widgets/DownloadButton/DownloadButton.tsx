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

import React, { memo, ReactElement, useContext, useEffect } from "react"

import { DownloadButton as DownloadButtonProto } from "@streamlit/protobuf"

import createDownloadLinkElement from "~lib/util/createDownloadLinkElement"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { LibContext } from "~lib/components/core/LibContext"

export interface Props {
  endpoints: StreamlitEndpoints
  disabled: boolean
  element: DownloadButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

export function createDownloadLink(
  endpoints: StreamlitEndpoints,
  url: string,
  enforceDownloadInNewTab: boolean
): HTMLAnchorElement {
  return createDownloadLinkElement({
    enforceDownloadInNewTab,
    url: endpoints.buildMediaURL(url),
    filename: "",
  })
}

function DownloadButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, endpoints, fragmentId } = props

  const {
    libConfig: { enforceDownloadInNewTab = false }, // Default to false, if no libConfig, e.g. for tests
  } = useContext(LibContext)

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  useEffect(() => {
    // Since we use a hidden link to download, we can't use the onerror event
    // to catch src url load errors. Catch with direct check instead.
    void endpoints.checkSourceUrlResponse(element.url, "Download Button")
  }, [element.url, endpoints])

  const handleDownloadClick: () => void = () => {
    if (!element.ignoreRerun) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
    }
    // Downloads are only done on links, so create a hidden one and click it
    // for the user.
    const link = createDownloadLink(
      endpoints,
      element.url,
      enforceDownloadInNewTab
    )
    link.click()
  }

  return (
    <div className="stDownloadButton" data-testid="stDownloadButton">
      <BaseButtonTooltip help={element.help} containerWidth={true}>
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled}
          onClick={handleDownloadClick}
          containerWidth={true}
        >
          <DynamicButtonLabel icon={element.icon} label={element.label} />
        </BaseButton>
      </BaseButtonTooltip>
    </div>
  )
}

export default memo(DownloadButton)
