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

import React, { memo, MouseEvent, ReactElement } from "react"

import { LinkButton as LinkButtonProto } from "@streamlit/protobuf"

import { Box } from "~lib/components/shared/Base/styled-components"
import {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"

import BaseLinkButton from "./BaseLinkButton"

export interface Props {
  element: LinkButtonProto
}

function LinkButton(props: Readonly<Props>): ReactElement {
  const { element } = props

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    // Prevent the link from being followed if the button is disabled.
    if (element.disabled) {
      e.preventDefault()
    }
  }

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
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={element.disabled}
          onClick={handleClick}
          href={element.url}
          target="_blank"
          rel="noreferrer"
          aria-disabled={element.disabled}
        >
          <DynamicButtonLabel icon={element.icon} label={element.label} />
        </BaseLinkButton>
      </BaseButtonTooltip>
    </Box>
  )
}

export default memo(LinkButton)
