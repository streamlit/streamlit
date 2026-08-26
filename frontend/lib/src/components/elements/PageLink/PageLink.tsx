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

import { memo, ReactElement, useContext } from "react"

import { PageLink as PageLinkProto } from "@streamlit/protobuf"

import { NavigationContext } from "~lib/components/core/NavigationContext"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { mapProtoIconPosition } from "~lib/components/shared/BaseButton/iconPosition"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  StyledNavLink,
  StyledNavLinkContainer,
  StyledNavLinkText,
} from "./styled-components"

/**
 * Builds the href URL for a page link, appending query string parameters if present.
 */
export function buildHref(element: PageLinkProto): string {
  let href = element.page
  if (element.queryString) {
    if (element.external) {
      // External links: use URL API to properly handle fragments
      try {
        const url = new URL(element.page)
        const params = new URLSearchParams(element.queryString)
        params.forEach((value, key) => url.searchParams.append(key, value))
        href = url.toString()
      } catch {
        // Fallback if URL parsing fails
        const [urlBase, fragment] = href.split("#")
        href =
          urlBase +
          (urlBase.includes("?") ? "&" : "?") +
          element.queryString +
          (fragment ? "#" + fragment : "")
      }
    } else {
      // Internal links: append query string to relative path
      href += (href.includes("?") ? "&" : "?") + element.queryString
    }
  }
  return href
}

export interface Props {
  disabled: boolean
  element: PageLinkProto
}

function PageLink(props: Readonly<Props>): ReactElement {
  const { onPageChange, currentPageScriptHash } = useContext(NavigationContext)

  const { colors } = useEmotionTheme()

  const { disabled, element } = props

  const isCurrentPage = currentPageScriptHash === element.pageScriptHash

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (element.external) {
      // External Page Link
      if (disabled) {
        e.preventDefault()
      }
    } else {
      // MPA Page Link
      e.preventDefault()
      if (!disabled) {
        onPageChange(element.pageScriptHash, element.queryString)
      }
    }
  }

  const iconPosition = mapProtoIconPosition(element.iconPosition)
  const href = buildHref(element)

  return (
    <div className="stPageLink" data-testid="stPageLink">
      <BaseButtonTooltip
        help={element.help}
        placement={Placement.TOP_RIGHT}
        containerWidth={true}
      >
        <StyledNavLinkContainer>
          <StyledNavLink
            data-testid="stPageLink-NavLink"
            disabled={disabled}
            isCurrentPage={isCurrentPage}
            href={href}
            target={element.external ? "_blank" : ""}
            rel="noreferrer"
            onClick={handleClick}
          >
            {element.icon && iconPosition === "left" && (
              <DynamicIcon
                size="base"
                color={disabled ? colors.fadedText40 : colors.bodyText}
                iconValue={element.icon}
              />
            )}
            <StyledNavLinkText disabled={disabled}>
              <StreamlitMarkdown
                source={element.label}
                allowHTML={false}
                isLabel
                boldLabel={isCurrentPage}
                disableLinks
              />
            </StyledNavLinkText>
            {element.icon && iconPosition === "right" && (
              <DynamicIcon
                size="base"
                color={disabled ? colors.fadedText40 : colors.bodyText}
                iconValue={element.icon}
              />
            )}
          </StyledNavLink>
        </StyledNavLinkContainer>
      </BaseButtonTooltip>
    </div>
  )
}

export default memo(PageLink)
