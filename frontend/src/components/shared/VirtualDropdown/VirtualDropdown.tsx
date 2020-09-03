import React, { ReactElement } from "react"
import { StyledDropdownListItem } from "baseui/select"
import { StyledList, StyledEmptyState, OptionListProps } from "baseui/menu"
import { FixedSizeList } from "react-window"

const LIST_ITEM_HEIGHT = 40
const EMPTY_LIST_HEIGHT = 90
const MAX_LIST_HEIGHT = 300

interface FixedSizeListeItemProps {
  data: { props: OptionListProps }[]
  index: number
  style: React.CSSProperties
}

function FixedSizeListItem(props: FixedSizeListeItemProps): ReactElement {
  const { data, index, style } = props
  const { item, ...restChildProps } = data[index].props
  return (
    <StyledDropdownListItem
      key={item.value}
      style={{
        boxSizing: "border-box",
        paddingTop: 0,
        paddingBottom: 0,
        display: "flex",
        alignItems: "center",
        ...style,
      }}
      {...restChildProps}
    >
      {item.label}
    </StyledDropdownListItem>
  )
}

const VirtualDropdown = React.forwardRef((props: any, ref) => {
  const children = React.Children.toArray(
    props.children
  ) as React.ReactElement[]

  if (!children[0] || !children[0].props.item) {
    return (
      <StyledList $style={{ height: `${EMPTY_LIST_HEIGHT}px` }} ref={ref}>
        <StyledEmptyState {...children[0].props} />
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
