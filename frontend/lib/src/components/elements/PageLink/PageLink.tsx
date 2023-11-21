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
import { EmojiIcon } from "@streamlit/lib/src/components/shared/Icon"
import { PageLink as PageLinkProto } from "@streamlit/lib/src/proto"
import { BaseButtonTooltip } from "@streamlit/lib/src/components/shared/BaseButton"

import { LibContext } from "@streamlit/lib/src/components/core/LibContext"

import {
  StyledNavLink,
  StyledNavLinkText,
  StyledNavLinkContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: PageLinkProto
  width: number
}

function checkIfActive(
  element: PageLinkProto,
  currentPageScriptHash: string
): boolean {
  console.log(currentPageScriptHash, element.pageScriptHash)
  if (element.active === "auto") {
    return currentPageScriptHash === element.pageScriptHash
  } else if (element.active === "true") {
    return true
  }
  return false
}

function PageLink(props: Props): ReactElement {
  const { onPageChange, currentPageScriptHash } = React.useContext(LibContext)
  const { disabled, element, width } = props
  const style = { width }
  console.log(element.label)
  const isActive = checkIfActive(element, currentPageScriptHash)

  return (
    <div
      className="row-widget stPageLink"
      data-testid="stPageLink"
      style={style}
    >
      <BaseButtonTooltip help={element.help}>
        <StyledNavLinkContainer>
          <StyledNavLink
            data-testid="stPageNavLink"
            disabled={disabled}
            isActive={isActive}
            useContainerWidth={element.useContainerWidth}
            href={element.pagePath}
            onClick={e => {
              e.preventDefault()
              if (!disabled) {
                onPageChange(element.pageScriptHash as string)
              }
            }}
          >
            {element.icon && <EmojiIcon size="lg">{element.icon}</EmojiIcon>}
            <StyledNavLinkText disabled={disabled} isActive={true}>
              {element.label}
            </StyledNavLinkText>
          </StyledNavLink>
        </StyledNavLinkContainer>
      </BaseButtonTooltip>
    </div>
  )
}

export default PageLink
