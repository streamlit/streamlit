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

import React, {
  memo,
  MouseEvent,
  ReactElement,
  useCallback,
  useRef,
} from "react"

import { LinkButton as LinkButtonProto } from "@streamlit/protobuf"

import { Box } from "~lib/components/shared/Base/styled-components"
import {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { useRegisterShortcut } from "~lib/hooks/useRegisterShortcut"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import BaseLinkButton from "./BaseLinkButton"

export interface Props {
  element: LinkButtonProto
  disabled: boolean
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function LinkButton(props: Readonly<Props>): ReactElement {
  const { element, disabled, widgetMgr, fragmentId } = props
  const shortcut = element.shortcut ? element.shortcut : undefined
  const { ignoreRerun } = element

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  const anchorRef = useRef<HTMLAnchorElement | null>(null)

  const handleShortcut = useCallback((): void => {
    if (disabled) {
      return
    }

    anchorRef.current?.click()
  }, [disabled])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>): void => {
      if (disabled) {
        // Prevent the link from being followed if the button is disabled.
        event.preventDefault()
        return
      }

      // Trigger a rerun if ignoreRerun is false
      if (!ignoreRerun) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        widgetMgr.setTriggerValue(element, { fromUi: true }, fragmentId)
      }
    },
    [disabled, ignoreRerun, widgetMgr, element, fragmentId]
  )

  useRegisterShortcut({
    shortcut,
    disabled,
    onActivate: handleShortcut,
  })

  return (
    <Box className="stLinkButton" data-testid="stLinkButton">
      <BaseButtonTooltip
        help={element.help}
        // TODO(lawilby): Probably remove this once width is implemented on Popover.
        containerWidth={true}
      >
        {/* We use separate BaseLinkButton instead of BaseButton here, because
        link behavior requires tag <a> instead of <button>.*/}
        <BaseLinkButton
          ref={anchorRef}
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled}
          onClick={handleClick}
          href={element.url}
          target="_blank"
          rel="noreferrer"
          aria-disabled={disabled}
        >
          <DynamicButtonLabel
            icon={element.icon}
            label={element.label}
            shortcut={shortcut}
          />
        </BaseLinkButton>
      </BaseButtonTooltip>
    </Box>
  )
}

export default memo(LinkButton)
