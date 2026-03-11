/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, useCallback } from "react"

import { Button as ButtonProto } from "@streamlit/protobuf"

import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import { mapProtoIconPosition } from "~lib/components/shared/BaseButton/iconPosition"
import { useRegisterShortcut } from "~lib/hooks/useRegisterShortcut"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function Button(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props
  const shortcut = element.shortcut ? element.shortcut : undefined

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  const handleTrigger = useCallback(() => {
    if (disabled) {
      return
    }

    void widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
  }, [disabled, widgetMgr, element, fragmentId])

  useRegisterShortcut({
    shortcut,
    disabled,
    onActivate: handleTrigger,
  })

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
          onClick={handleTrigger}
        >
          <DynamicButtonLabel
            icon={element.icon}
            iconPosition={mapProtoIconPosition(element.iconPosition)}
            label={element.label}
            shortcut={shortcut}
          />
        </BaseButton>
      </BaseButtonTooltip>
    </Box>
  )
}

export default memo(Button)
