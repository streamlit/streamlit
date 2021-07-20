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

import React, { ReactElement } from "react"
import { DownloadButton as DownloadButtonProto } from "src/autogen/proto"
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
  const { disabled, element, widgetMgr, width } = props
  const style = { width }

  const handleDownloadClick: () => void = () => {
    // Downloads are only done on links, so create a hidden one and click it
    // for the user.
    const link = document.createElement("a")
    link.setAttribute("href", buildMediaUri(element.url))
    link.setAttribute("download", element.fileName)
    link.text = "hello"
    link.click()
    console.log(link)
  }

  return (
    <div className="row-widget stButton" style={style}>
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={Kind.PRIMARY}
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
