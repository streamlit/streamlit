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

import React, { ReactElement } from "react"
import { Button as ButtonProto } from "src/autogen/proto"
import UIButton, {
  ButtonTooltip,
  Kind,
  Size,
} from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"

export interface Props {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  width: number
}

function Button(props: Props): ReactElement {
  const { disabled, element, widgetMgr, width } = props
  const style = { width }

  const kind = element.type === "primary" ? Kind.PRIMARY : Kind.SECONDARY

  return (
    <div className="row-widget stButton" style={style}>
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={kind}
          size={Size.SMALL}
          disabled={disabled}
          onClick={() => widgetMgr.setTriggerValue(element, { fromUi: true })}
        >
          <StreamlitMarkdown source={element.label} allowHTML={false} />
        </UIButton>
      </ButtonTooltip>
    </div>
  )
}

export default Button
