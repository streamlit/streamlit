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

import { Breadcrumbs as BreadcrumbsProto } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon"
import { Placement } from "~lib/components/shared/Tooltip"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledBreadcrumbCurrent,
  StyledBreadcrumbIcon,
  StyledBreadcrumbItem,
  StyledBreadcrumbLink,
  StyledBreadcrumbs,
  StyledBreadcrumbSeparator,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: BreadcrumbsProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

const renderIcon = (
  iconName: string | null | undefined
): ReactElement | null => {
  if (!iconName) {
    return null
  }
  return (
    <StyledBreadcrumbIcon>
      <DynamicIcon size="md" iconValue={iconName} color="inherit" />
    </StyledBreadcrumbIcon>
  )
}

function Breadcrumbs({
  element,
  disabled,
  widgetMgr,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const { items, help, separator, value } = element

  // Determine the selected index: use the value if set, otherwise default to last item
  const selectedIndex = value ? parseInt(value, 10) : items.length - 1

  const handleClick = useCallback(
    (index: number): void => {
      if (disabled) {
        return
      }
      widgetMgr.setIntValue(element, index, { fromUi: true }, fragmentId)
    },
    [disabled, element, widgetMgr, fragmentId]
  )

  const renderSeparator = (): ReactElement => (
    <StyledBreadcrumbSeparator aria-hidden="true">
      {separator.startsWith(":material/") ? (
        <DynamicIcon size="md" iconValue={separator} color="inherit" />
      ) : (
        separator
      )}
    </StyledBreadcrumbSeparator>
  )

  return (
    <StyledBreadcrumbs
      className="stBreadcrumbs"
      data-testid="stBreadcrumbs"
      aria-label="Breadcrumb"
    >
      <ol>
        {items.map((item, index) => {
          const isSelected = index === selectedIndex
          const icon = item.contentIcon ?? null
          const content = item.content ?? ""

          // When disabled, all items render as plain text (non-interactive)
          // Otherwise, only the selected item renders as plain text
          const renderAsPlainText = disabled || isSelected

          return (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- Items don't have unique IDs and content can be duplicated
            <StyledBreadcrumbItem key={`${content}-${index}`}>
              {renderAsPlainText ? (
                <StyledBreadcrumbCurrent
                  aria-current={isSelected ? "page" : undefined}
                  $disabled={disabled}
                >
                  {renderIcon(icon)}
                  <span>{content}</span>
                </StyledBreadcrumbCurrent>
              ) : (
                <StyledBreadcrumbLink
                  onClick={() => handleClick(index)}
                  $disabled={disabled}
                  type="button"
                >
                  {renderIcon(icon)}
                  <span>{content}</span>
                </StyledBreadcrumbLink>
              )}
              {index < items.length - 1 && renderSeparator()}
            </StyledBreadcrumbItem>
          )
        })}
      </ol>
      {help && (
        <WidgetLabelHelpIconInline content={help} placement={Placement.TOP} />
      )}
    </StyledBreadcrumbs>
  )
}

export default memo(Breadcrumbs)
