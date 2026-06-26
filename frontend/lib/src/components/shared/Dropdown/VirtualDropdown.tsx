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

import { Children, forwardRef, ReactElement } from "react"

import {
  type OptionListProps,
  StyledEmptyState,
  StyledList,
} from "baseui/menu"
import { FixedSizeList } from "react-window"

import { StyledHighlightWrapper } from "~lib/components/shared/Highlight/styled-components"
import OverflowTooltip from "~lib/components/shared/Tooltip/OverflowTooltip"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"
import { convertRemToPx } from "~lib/theme/utils"

import { ThemedStyledDropdownListItem } from "./styled-components"

// Constants for special dropdown option IDs used by Multiselect
export const SELECT_ALL_ID = "__SELECT_ALL__"
export const SELECT_MATCHES_ID = "__SELECT_MATCHES__"

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
  const {
    item,
    overrides: _overrides,
    $isHighlighted,
    ...restChildProps
  } = data[index].props as OptionListProps & { $isHighlighted?: boolean }

  // isCreatable is set by baseui when the option is not in the list of options and the user is typing a new one
  const label = item.isCreatable ? `Add: ${item.label}` : item.label

  // Check if this is a special option (Select all / Select X matches)
  const isSelectAll =
    item.id === SELECT_ALL_ID || item.id === SELECT_MATCHES_ID

  return (
    <ThemedStyledDropdownListItem
      key={item.value}
      style={style}
      $isSelectAll={isSelectAll}
      $isCreatable={item.isCreatable}
      {...restChildProps}
    >
      <StyledHighlightWrapper $isHighlighted={$isHighlighted}>
        <OverflowTooltip content={label} placement={Placement.AUTO}>
          {label}
        </OverflowTooltip>
      </StyledHighlightWrapper>
    </ThemedStyledDropdownListItem>
  )
}

interface VirtualDropdownProps {
  children?: React.ReactNode
}

const VirtualDropdown = forwardRef<HTMLUListElement, VirtualDropdownProps>(
  (props, ref) => {
    const theme = useEmotionTheme()
    const scrollbarGutterSize = useScrollbarGutterSize()
    const { innerHeight: windowHeight } = useWindowDimensionsContext()

    // TODO: Update to match React best practices
    // eslint-disable-next-line @eslint-react/no-children-to-array
    const children = Children.toArray(props.children) as ReactElement[]

    if (!children[0]?.props.item) {
      const childrenProps = children[0] ? children[0].props : {}
      return (
        <StyledList
          $style={{
            height: theme.sizes.emptyDropdownHeight,
            paddingLeft: theme.spacing.none,
            paddingRight: theme.spacing.none,
            paddingTop: theme.spacing.none,
            paddingBottom: theme.spacing.none,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Somehow this adds an additional shadow, even though we already have
            // one on the popover, so we need to remove it here.
            boxShadow: "none",
            overflow: "hidden",
          }}
          ref={ref}
          data-testid="stSelectboxVirtualDropdownEmpty"
        >
          <StyledEmptyState
            $style={{
              paddingLeft: theme.spacing.none,
              paddingRight: theme.spacing.none,
              paddingTop: theme.spacing.none,
              paddingBottom: theme.spacing.none,
              color: theme.colors.fadedText60,
            }}
            {...childrenProps}
          />
        </StyledList>
      )
    }

    const maxHeight = Math.min(
      convertRemToPx(theme.sizes.maxDropdownHeight),
      windowHeight * 0.7 // 70vh constraint on popover body
    )
    const contentHeight =
      children.length * convertRemToPx(theme.sizes.dropdownItemHeight)
    const height = Math.min(maxHeight, contentHeight)

    // Check if scrollbar will be visible (content exceeds max height)
    const hasScrollbar = contentHeight > maxHeight

    // Only account for scrollbar gutter when scrollbar is actually visible
    // and we're in classic scrollbar mode (gutter > 0)
    const effectiveGutterSize = hasScrollbar ? scrollbarGutterSize : 0

    // Find the highlighted (selected) item so we can scroll to it on open
    const itemSize = convertRemToPx(theme.sizes.dropdownItemHeight)
    const highlightedIndex = children.findIndex(
      child =>
        (child.props as OptionListProps & { $isHighlighted?: boolean })
          .$isHighlighted
    )
    // Center the highlighted item in view; stay at top if first or none highlighted.
    // Clamp to maxScrollOffset so we don't virtualize away items at the top
    // when the list fits without overflow (offsets past the end are unreachable
    // because the browser pins scrollTop to 0).
    const maxScrollOffset = Math.max(0, contentHeight - height)
    const initialScrollOffset =
      highlightedIndex > 0
        ? Math.min(
            Math.max(
              0,
              highlightedIndex * itemSize - height / 2 + itemSize / 2
            ),
            maxScrollOffset
          )
        : 0

    return (
      <StyledList
        ref={ref}
        $style={{
          // Padding to inset items from the edges (no right padding so scrollbar sits at edge)
          paddingTop: theme.spacing.none,
          paddingBottom: theme.spacing.none,
          paddingLeft: theme.spacing.none,
          paddingRight: theme.spacing.none,
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
          itemSize={itemSize}
          initialScrollOffset={initialScrollOffset}
          style={
            {
              // Pass scrollbar gutter size to children via CSS custom property
              // so they can adjust their margins when scrollbar is visible in classic mode.
              "--scrollbar-gutter-size": `${effectiveGutterSize}px`,
            } as React.CSSProperties
          }
        >
          {FixedSizeListItem}
        </FixedSizeList>
      </StyledList>
    )
  }
)

VirtualDropdown.displayName = "VirtualDropdown"

export default VirtualDropdown
