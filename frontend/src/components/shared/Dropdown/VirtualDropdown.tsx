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
import { StyledList, StyledEmptyState, OptionListProps } from "baseui/menu"
import { FixedSizeList } from "react-window"
import { Placement, OverflowTooltip } from "src/components/shared/Tooltip"
import { ThemedStyledDropdownListItem } from "./styled-components"

const LIST_ITEM_HEIGHT = 40
const EMPTY_LIST_HEIGHT = 90
const MAX_LIST_HEIGHT = 300

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
  return (
    <ThemedStyledDropdownListItem
      key={item.value}
      style={style}
      {...restChildProps}
    >
      <OverflowTooltip content={item.label} placement={Placement.AUTO}>
        {item.label}
      </OverflowTooltip>
    </ThemedStyledDropdownListItem>
  )
}

const VirtualDropdown = React.forwardRef((props: any, ref) => {
  const children = React.Children.toArray(props.children) as ReactElement[]

  if (!children[0] || !children[0].props.item) {
    const childrenProps = children[0] ? children[0].props : {}
    return (
      <StyledList $style={{ height: `${EMPTY_LIST_HEIGHT}px` }} ref={ref}>
        <StyledEmptyState {...childrenProps} />
      </StyledList>
    )
  }

  const height = Math.min(MAX_LIST_HEIGHT, children.length * LIST_ITEM_HEIGHT)

  return (
    <StyledList ref={ref} $style={{ paddingTop: 0, paddingBottom: 0 }}>
      <FixedSizeList
        width="100%"
        height={height}
        itemCount={children.length}
        itemData={children}
        itemKey={(index: number, data: { props: OptionListProps }[]) =>
          data[index].props.item.value
        }
        itemSize={LIST_ITEM_HEIGHT}
      >
        {FixedSizeListItem}
      </FixedSizeList>
    </StyledList>
  )
})

VirtualDropdown.displayName = "VirtualDropdown"

export default VirtualDropdown
