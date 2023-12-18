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
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { PageLink as PageLinkProto } from "@streamlit/lib/src/proto"
import { BaseButtonTooltip } from "@streamlit/lib/src/components/shared/BaseButton"

import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import IsSidebarContext from "@streamlit/lib/src/components/core/IsSidebarContext"

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
  if (element.active === "auto") {
    return currentPageScriptHash === element.pageScriptHash
  } else if (element.active === "true") {
    return true
  }
  return false
}

function checkCenterAlign(
  element: PageLinkProto,
  isInSidebar: boolean
): boolean {
  if (element.align) {
    return element.align === "center" ? true : false
  } else if (element.useContainerWidth) {
    return isInSidebar ? false : true
  } else {
    return false
  }
}

function PageLink(props: Props): ReactElement {
  const { onPageChange, currentPageScriptHash } = React.useContext(LibContext)
  const isInSidebar = React.useContext(IsSidebarContext)
  const { disabled, element, width } = props
  const style = { width }
  const isActive = checkIfActive(element, currentPageScriptHash)
  const center = checkCenterAlign(element, isInSidebar)

  return (
    <div
      className="row-widget stPageLink"
      data-testid="stPageLink"
      style={style}
    >
      <BaseButtonTooltip help={element.help} placement={Placement.TOP_RIGHT}>
        <StyledNavLinkContainer
          useContainerWidth={element.useContainerWidth}
          center={center}
        >
          <StyledNavLink
            data-testid="stPageNavLink"
            disabled={disabled}
            isActive={isActive}
            indent={element.indent}
            center={center}
            fluidWidth={element.useContainerWidth ? width : false}
            href={element.page}
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
