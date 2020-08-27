/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import without from "lodash/without"
import { Map as ImmutableMap } from "immutable"
import { multiSelectOverrides } from "lib/widgetTheme"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import {
  TYPE,
  Select as UISelect,
  OnChangeParams,
  StyledDropdownListItem,
} from "baseui/select"
import { withStyle } from "baseui"
import { StyledList, StyledEmptyState, OptionListProps } from "baseui/menu"
import { FixedSizeList } from "react-window"

const LIST_ITEM_HEIGHT = 40
const EMPTY_LIST_HEIGHT = 80
const MAX_LIST_HEIGHT = 300
const PADDING = 16

export interface Props {
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI.
   */
  value: number[]
}

interface MultiselectOption {
  label: string
  value: string
}

const ListItem = withStyle(StyledDropdownListItem, {
  paddingTop: 0,
  paddingBottom: 0,
  display: "flex",
  alignItems: "center",
})

const FixedSizeListItem = ({
  data,
  index,
  style,
}: {
  data: { props: OptionListProps }[]
  index: number
  style: React.CSSProperties
}) => {
  const { item, overrides, ...restChildProps } = data[index].props
  return (
    <ListItem
      key={item.value}
      style={{
        boxSizing: "border-box",
        ...style,
      }}
      {...restChildProps}
    >
      {item.label}
    </ListItem>
  )
}

const VirtualDropdown = React.forwardRef((props: any, ref) => {
  const children = React.Children.toArray(
    props.children
  ) as React.ReactElement[]

  if (!children[0] || !children[0].props.item) {
    return (
      <StyledList $style={{ height: EMPTY_LIST_HEIGHT + "px" }} ref={ref}>
        <StyledEmptyState {...children[0].props} />
      </StyledList>
    )
  }

  const height = Math.min(
    MAX_LIST_HEIGHT,
    children.length * LIST_ITEM_HEIGHT + PADDING
  )

  return (
    <StyledList $style={{ height: height + "px" }} ref={ref}>
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

class Multiselect extends React.PureComponent<Props, State> {
  public state: State = {
    value: this.props.element.get("default").toArray(),
  }

  public componentDidMount(): void {
    this.setWidgetValue({ fromUi: false })
  }

  private setWidgetValue = (source: Source): void => {
    const widgetId: string = this.props.element.get("id")
    this.props.widgetMgr.setIntArrayValue(widgetId, this.state.value, source)
  }

  private get valueFromState(): MultiselectOption[] {
    return this.state.value.map(i => {
      const label = this.props.element.get("options").get(i)
      return { value: i.toString(), label }
    })
  }

  private generateNewState(data: any): State {
    const getIndex = (): number => {
      const valueId = data.option.value
      return parseInt(valueId, 10)
    }

    switch (data.type) {
      case "remove": {
        return { value: without(this.state.value, getIndex()) }
      }
      case "clear": {
        return { value: [] }
      }
      case "select": {
        return { value: this.state.value.concat([getIndex()]) }
      }
      default: {
        throw new Error(`State transition is unkonwn: {data.type}`)
      }
    }
  }

  private onChange = (params: OnChangeParams): void => {
    const newState = this.generateNewState(params)
    this.setState(newState, () => this.setWidgetValue({ fromUi: true }))
  }

  public render(): React.ReactNode {
    const { element, width } = this.props
    const style = { width }
    const label = element.get("label")
    const options = element.get("options")
    const disabled = options.size === 0 ? true : this.props.disabled
    const placeholder =
      options.size === 0 ? "No options to select." : "Choose an option"
    const selectOptions: MultiselectOption[] = options
      .map((option: string, idx: number) => {
        return {
          label: option,
          value: idx.toString(),
        }
      })
      .toArray()

    return (
      <div className="Widget row-widget stMultiSelect" style={style}>
        <label>{label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          placeholder={placeholder}
          type={TYPE.select}
          multi
          onChange={this.onChange}
          value={this.valueFromState}
          disabled={disabled}
          size={"compact"}
          overrides={Object.assign(multiSelectOverrides, {
            Dropdown: { component: VirtualDropdown },
          })}
        />
      </div>
    )
  }
}

export default Multiselect
