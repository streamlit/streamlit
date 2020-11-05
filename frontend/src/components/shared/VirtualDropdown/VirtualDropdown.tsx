import React, { ReactElement } from "react"
import { StyledDropdownListItem } from "baseui/select"
import { StyledList, StyledEmptyState, OptionListProps } from "baseui/menu"
import { FixedSizeList } from "react-window"
import styled from "@emotion/styled"

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

const TruncateText = styled.span({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
})

const ThemedStyledDropdownListItem = styled(StyledDropdownListItem)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
  })
)

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
      <TruncateText>{item.label}</TruncateText>
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
    <StyledList ref={ref}>
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
