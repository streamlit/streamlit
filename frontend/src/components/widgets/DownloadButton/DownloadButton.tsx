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

import React, { ReactElement, useContext, useEffect, useState } from "react"
import { DownloadButton as DownloadButtonProto } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import UIButton, {
  ButtonTooltip,
  Kind,
  Size,
} from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { buildMediaUri } from "src/lib/UriUtil"

export interface Props {
  disabled: boolean
  element: DownloadButtonProto
  widgetMgr: WidgetStateManager
  width: number
}

function DownloadButton(props: Props): ReactElement {
  const { element, widgetMgr, width } = props
  const style = { width }
  const { getBaseUriParts } = useContext(AppContext)
  const [disabled, setDisabled] = useState(props.disabled)

  useEffect(() => {
    if (element.readyToDownload) {
      // Downloads are only done on links, so create a hidden one and
      // click it for the user.
      const link = document.createElement("a")
      const uri = `${buildMediaUri(
        element.url,
        getBaseUriParts()
      )}?title=${encodeURIComponent(document.title)}`
      link.setAttribute("href", uri)
      link.setAttribute("target", "_blank")
      link.click()

      element.readyToDownload = false
      setDisabled(props.disabled)
    }
  }, [element.readyToDownload])

  const handleDownloadClick: () => void = () => {
    element.readyToDownload = false
    setDisabled(true)
    widgetMgr.setTriggerValue(element, { fromUi: true })
  }

  return (
    <div className="row-widget stDownloadButton" style={style}>
      <div>{element.readyToDownload.toString()}</div>
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={Kind.SECONDARY}
          size={Size.SMALL}
          disabled={disabled}
          onClick={handleDownloadClick}
        >
          {element.label}
        </UIButton>
      </ButtonTooltip>
    </div>
  )
}

export default DownloadButton
