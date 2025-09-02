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

import React, { Children, forwardRef, ReactElement } from "react"

import {
  type OptionListProps,
  StyledEmptyState,
  StyledList,
} from "baseui/menu"
import { FixedSizeList } from "react-window"

import { OverflowTooltip, Placement } from "~lib/components/shared/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

import { ThemedStyledDropdownListItem } from "./styled-components"

/*
 * A component that renders a large dropdown to render only a fixed amount of
 * options at a time. Overall, the dropdown improves performance for
 * [Multi]Select components to display a practically large number of options.
 */
interface FixedSizeListItemProps {
  data: { props: OptionListProps }[]
  index: number
  style: React.CSSProperties
}

function FixedSizeListItem(props: FixedSizeListItemProps): ReactElement {
  const { data, index, style } = props
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { item, overrides, ...restChildProps } = data[index].props

  // isCreatable is set by baseui when the option is not in the list of options and the user is typing a new one
  const label = item.isCreatable ? `Add: ${item.label}` : item.label

  return (
    <ThemedStyledDropdownListItem
      key={item.value}
      style={style}
      {...restChildProps}
    >
      <OverflowTooltip content={label} placement={Placement.AUTO}>
        {label}
      </OverflowTooltip>
    </ThemedStyledDropdownListItem>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
const VirtualDropdown = forwardRef<any, any>((props, ref) => {
  const theme = useEmotionTheme()
  // TODO: Update to match React best practices
  // eslint-disable-next-line @eslint-react/no-children-to-array
  const children = Children.toArray(props.children) as ReactElement[]

  if (!children[0] || !children[0].props.item) {
    const childrenProps = children[0] ? children[0].props : {}
    return (
      <StyledList
        $style={{
          height: theme.sizes.emptyDropdownHeight,
          paddingBottom: theme.spacing.none,
          paddingTop: theme.spacing.none,
          paddingLeft: theme.spacing.none,
          paddingRight: theme.spacing.none,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Somehow this adds an additional shadow, even though we already have
          // one on the popover, so we need to remove it here.
          boxShadow: "none",
        }}
        ref={ref}
        data-testid="stSelectboxVirtualDropdownEmpty"
      >
        <StyledEmptyState
          $style={{
            paddingBottom: theme.spacing.none,
            paddingTop: theme.spacing.none,
            paddingLeft: theme.spacing.none,
            paddingRight: theme.spacing.none,
            color: theme.colors.fadedText60,
          }}
          {...childrenProps}
        />
      </StyledList>
    )
  }

  const height = Math.min(
    convertRemToPx(theme.sizes.maxDropdownHeight),
    children.length * convertRemToPx(theme.sizes.dropdownItemHeight)
  )

  return (
    <StyledList
      ref={ref}
      $style={{
        paddingTop: 0,
        paddingBottom: 0,
        // Somehow this adds an additional shadow, even though we already have
        // one on the popover, so we need to remove it here.
        boxShadow: "none",
      }}
      data-testid="stSelectboxVirtualDropdown"
    >
      <FixedSizeList
        width="100%"
        height={height}
        itemCount={children.length}
        itemData={children}
        itemKey={(index: number, data: { props: OptionListProps }[]) => {
          const { id, value } = data[index].props.item

          // For all current use cases, id should always be defined, but
          // we also allow the value to be used as a fallback.
          return id ?? value
        }}
        itemSize={convertRemToPx(theme.sizes.dropdownItemHeight)}
      >
        {FixedSizeListItem}
      </FixedSizeList>
    </StyledList>
  )
})

VirtualDropdown.displayName = "VirtualDropdown"

export default VirtualDropdown
