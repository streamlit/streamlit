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

import React, { MouseEvent, ReactElement } from "react"

import { LinkButton as LinkButtonProto } from "@streamlit/lib/src/proto"
import {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "@streamlit/lib/src/components/shared/BaseButton"

import BaseLinkButton from "./BaseLinkButton"

export interface Props {
  disabled: boolean
  element: LinkButtonProto
  width: number
}

function LinkButton(props: Readonly<Props>): ReactElement {
  const { disabled, element, width } = props
  const style = { width }

  const kind =
    element.type === "primary"
      ? BaseButtonKind.PRIMARY
      : BaseButtonKind.SECONDARY

  // When useContainerWidth true & has help tooltip,
  // we need to pass the container width down to the button
  const fluidWidth = element.help ? width : true

  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    // Prevent the link from being followed if the button is disabled.
    if (props.disabled) {
      e.preventDefault()
    }
  }

  return (
    <div className="stLinkButton" data-testid="stLinkButton" style={style}>
      <BaseButtonTooltip help={element.help}>
        {/* We use separate BaseLinkButton instead of BaseButton here, because
        link behavior requires tag <a> instead of <button>.*/}
        <BaseLinkButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={disabled}
          onClick={handleClick}
          fluidWidth={element.useContainerWidth ? fluidWidth : false}
          href={element.url}
          target="_blank"
          rel="noreferrer"
          aria-disabled={disabled}
        >
          <DynamicButtonLabel icon={element.icon} label={element.label} />
        </BaseLinkButton>
      </BaseButtonTooltip>
    </div>
  )
}

export default LinkButton
