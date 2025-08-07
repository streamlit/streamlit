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

import React, { memo, ReactElement } from "react"

import {
  LABEL_PLACEMENT,
  STYLE_TYPE,
  Checkbox as UICheckbox,
} from "baseui/checkbox"
import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"
import { transparentize } from "color2k"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"

const NAMELESS_INDEX_NAME = "(index)"

interface CheckboxItemProps {
  // The label to display for the checkbox.
  label: string
  // The initial value of the checkbox.
  initialValue: boolean
  // The callback that is called when the checkbox is checked/unchecked.
  onChange: (checked: boolean) => void
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({
  label,
  initialValue,
  onChange,
}) => {
  const theme = useEmotionTheme()

  return (
    <UICheckbox
      checked={initialValue}
      onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange(e.target.checked)
      }}
      aria-label={label}
      checkmarkType={STYLE_TYPE.default}
      labelPlacement={LABEL_PLACEMENT.right}
      overrides={{
        Root: {
          style: ({ $isFocusVisible }: { $isFocusVisible: boolean }) => ({
            marginBottom: theme.spacing.none,
            marginTop: theme.spacing.none,
            paddingLeft: theme.spacing.md,
            paddingRight: theme.spacing.md,
            paddingTop: theme.spacing.twoXS,
            paddingBottom: theme.spacing.twoXS,
            backgroundColor: $isFocusVisible
              ? theme.colors.darkenedBgMix25
              : "",
            display: "flex",
            alignItems: "start",
          }),
        },
        Checkmark: {
          style: ({
            $isFocusVisible,
            $checked,
          }: {
            $isFocusVisible: boolean
            $checked: boolean
          }) => {
            const borderColor = $checked
              ? theme.colors.primary
              : theme.colors.fadedText40

            return {
              outline: 0,
              width: theme.sizes.checkbox,
              height: theme.sizes.checkbox,
              marginTop: theme.spacing.twoXS,
              marginLeft: 0,
              marginBottom: 0,
              boxShadow:
                $isFocusVisible && $checked
                  ? `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`
                  : "",
              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,
              borderLeftColor: borderColor,
              borderRightColor: borderColor,
              borderTopColor: borderColor,
              borderBottomColor: borderColor,
            }
          },
        },
        Label: {
          style: {
            lineHeight: theme.lineHeights.small,
            paddingLeft: theme.spacing.sm,
            position: "relative",
            color: theme.colors.bodyText,
            fontSize: theme.fontSizes.sm,
            fontWeight: theme.fontWeights.normal,
          },
        },
      }}
    >
      {label}
    </UICheckbox>
  )
}

export interface ColumnVisibilityMenuProps {
  // The columns to display in the menu.
  columns: BaseColumn[]
  // The order of the columns.
  columnOrder: string[]
  // The callback to set the order of the columns.
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>
  // The callback to hide a column.
  hideColumn: (columnId: string) => void
  // The callback to show a column.
  showColumn: (columnId: string) => void
  // The toolbar action that opens the menu.
  children: React.ReactNode
  // Whether the menu is open.
  isOpen: boolean
  // A callback called when the menu is closed.
  onClose: () => void
}

/**
 * A menu that allows the user to hide and show columns in the data grid.
 */
const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  columns,
  columnOrder,
  setColumnOrder,
  hideColumn,
  showColumn,
  children,
  isOpen,
  onClose,
}): ReactElement => {
  const theme = useEmotionTheme()

  return (
    <UIPopover
      triggerType={TRIGGER_TYPE.click}
      placement={PLACEMENT.bottomRight}
      autoFocus={true}
      focusLock={true}
      content={() => (
        <div
          style={{
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
          }}
        >
          {columns.map(column => {
            // A column can be hidden if configured in column config
            // or if the user has configured a column order that doesn't
            // include the column.
            const hiddenViaColumnOrder =
              columnOrder.length && !column.isIndex
                ? !columnOrder.includes(column.id) &&
                  !columnOrder.includes(column.name)
                : false

            return (
              <CheckboxItem
                key={column.id}
                label={
                  !column.title && column.isIndex
                    ? NAMELESS_INDEX_NAME
                    : column.title
                }
                initialValue={
                  !(column.isHidden === true || hiddenViaColumnOrder)
                }
                onChange={checked => {
                  if (checked) {
                    showColumn(column.id)
                    if (hiddenViaColumnOrder) {
                      // Add the column to the column order list:
                      setColumnOrder((prevColumnOrder: string[]) => [
                        ...prevColumnOrder,
                        column.id,
                      ])
                    }
                  } else {
                    hideColumn(column.id)
                  }
                }}
              />
            )
          })}
        </div>
      )}
      isOpen={isOpen}
      onClickOutside={onClose}
      onClick={() => (isOpen ? onClose() : undefined)}
      onEsc={onClose}
      ignoreBoundary={false}
      overrides={{
        Body: {
          props: {
            "data-testid": "stDataFrameColumnVisibilityMenu",
          },
          style: {
            borderTopLeftRadius: theme.radii.default,
            borderTopRightRadius: theme.radii.default,
            borderBottomLeftRadius: theme.radii.default,
            borderBottomRightRadius: theme.radii.default,

            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",

            backgroundColor: "transparent",
            border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          },
        },
        Inner: {
          style: {
            backgroundColor: hasLightBackgroundColor(theme)
              ? theme.colors.bgColor
              : theme.colors.secondaryBg,
            color: theme.colors.bodyText,
            fontSize: theme.fontSizes.sm,
            fontWeight: theme.fontWeights.normal,
            minWidth: theme.sizes.minMenuWidth,
            maxWidth: `calc(${theme.sizes.minMenuWidth} * 2)`,
            maxHeight: theme.sizes.maxDropdownHeight,
            overflow: "auto",
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
    >
      {<div>{children}</div>}
    </UIPopover>
  )
}

export default memo(ColumnVisibilityMenu)
