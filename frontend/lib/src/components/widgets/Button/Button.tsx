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

import React, { memo, ReactElement } from "react"

import { Button as ButtonProto } from "@streamlit/protobuf"

import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function Button(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  return (
    <Box className="stButton" data-testid="stButton">
      <BaseButtonTooltip
        help={element.help}
        // The element wrapper determines the width so
        // we should always expand to fill the wrapper.
        containerWidth={true}
      >
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled}
          containerWidth={true}
          onClick={() =>
            widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
          }
        >
          <DynamicButtonLabel icon={element.icon} label={element.label} />
        </BaseButton>
      </BaseButtonTooltip>
    </Box>
  )
}

export default memo(Button)
