/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import UIButton, { Kind, Size } from "components/shared/Button"
import { Button as ButtonProto } from "autogen/proto"
import { WidgetStateManager } from "lib/WidgetStateManager"
import Tooltip, { Placement } from "components/shared/Tooltip"
import StreamlitMarkdown from "components/shared/StreamlitMarkdown"

export interface ButtonProps {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  width: number
}

interface ButtonTooltipProps {
  children: ReactElement
  help?: string
}

function ButtonTooltip(props: ButtonTooltipProps): ReactElement {
  const { children, help } = props
  if (!help) {
    return children
  }
  return (
    <div className="stTooltipIcon">
      <Tooltip
        inline
        content={<StreamlitMarkdown source={help} allowHTML />}
        placement={Placement.RIGHT}
      >
        {children}
      </Tooltip>
    </div>
  )
}

function Button(props: ButtonProps): ReactElement {
  const { disabled, element, widgetMgr, width } = props
  const style = { width }

  const handleClick = (): void => {
    const widgetId = element.id
    widgetMgr.setTriggerValue(widgetId, { fromUi: true })
  }

  return (
    <div className="row-widget stButton" style={style}>
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={Kind.PRIMARY}
          size={Size.SMALL}
          disabled={disabled}
          onClick={handleClick}
        >
          {element.label}
        </UIButton>
      </ButtonTooltip>
    </div>
  )
}

export default Button
