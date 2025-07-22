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

import { PLACEMENT, Popover, TRIGGER_TYPE } from "baseui/popover"

import { DynamicIcon } from "~lib/components/shared/Icon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"

import { StyledMenuList, StyledMenuListItem } from "./styled-components"

/**
 * A list of formats available for number columns (number & progress).
 * Each format has a label, icon, and format ID.
 */
const NUMBER_FORMATS: { format: string; label: string; icon: string }[] = [
  {
    format: "",
    label: "Automatic",
    icon: ":material/123:",
  },
  {
    format: "localized",
    label: "Localized",
    icon: ":material/translate:",
  },
  {
    format: "plain",
    label: "Plain",
    icon: ":material/speed_1_75:",
  },
  {
    format: "compact",
    label: "Compact",
    icon: ":material/1k:",
  },
  {
    format: "dollar",
    label: "Dollar",
    icon: ":material/attach_money:",
  },
  {
    format: "euro",
    label: "Euro",
    icon: ":material/euro:",
  },
  {
    format: "yen",
    label: "Yen",
    icon: ":material/currency_yen:",
  },
  {
    format: "percent",
    label: "Percent",
    icon: ":material/percent:",
  },
  {
    format: "scientific",
    label: "Scientific",
    icon: ":material/experiment:",
  },
  {
    format: "accounting",
    label: "Accounting",
    icon: ":material/finance_chip:",
  },
]
/**
 * A mapping of column kinds to their available formats.
 * Each column kind has an array of objects, each representing a format
 * with a label, icon, and format ID (should match the pre-defined formats
 * available for the column type).
 */
const COLUMN_KIND_FORMAT_MAPPING: Record<
  string,
  { format: string; label: string; icon: string }[]
> = {
  number: NUMBER_FORMATS,
  progress: NUMBER_FORMATS,
  datetime: [
    {
      format: "",
      label: "Automatic",
      icon: ":material/schedule:",
    },
    {
      format: "localized",
      label: "Localized",
      icon: ":material/translate:",
    },
    {
      format: "distance",
      label: "Distance",
      icon: ":material/search_activity:",
    },
    {
      format: "calendar",
      label: "Calendar",
      icon: ":material/today:",
    },
  ],
  date: [
    {
      format: "",
      label: "Automatic",
      icon: ":material/schedule:",
    },
    {
      format: "localized",
      label: "Localized",
      icon: ":material/translate:",
    },
    {
      format: "distance",
      label: "Distance",
      icon: ":material/search_activity:",
    },
  ],
  time: [
    {
      format: "",
      label: "Automatic",
      icon: ":material/schedule:",
    },
    {
      format: "localized",
      label: "Localized",
      icon: ":material/translate:",
    },
  ],
}

export interface FormattingMenuProps {
  // The kind of the column to format.
  columnKind: string
  // Whether the menu is open.
  isOpen: boolean
  // A callback when the mouse enters the menu.
  onMouseEnter: () => void
  // A callback when the mouse leaves the menu.
  onMouseLeave: () => void
  // A callback when the user selects a new format.
  onChangeFormat: (format: string) => void
  // A callback when the menu is closed.
  onCloseMenu: () => void
  // The menu item that should trigger the menu to open (on hover)
  children: ReactElement
}

/**
 * FormattingMenu is a component that displays a list of formats for a given column kind.
 * It allows to change the format of a column from the data grid UI.
 *
 * @param columnKind - The kind of the column to format.
 * @param isOpen - Whether the menu is open.
 * @param onMouseEnter - The function to call when the mouse enters the menu.
 * @param onMouseLeave - The function to call when the mouse leaves the menu.
 * @param onChangeFormat - The function to call when the format changes.
 * @param onCloseMenu - The function to call when the menu is closed.
 * @param children - The menu item that triggers the menu to open.
 */
function FormattingMenu({
  columnKind,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  onChangeFormat,
  onCloseMenu,
  children,
}: FormattingMenuProps): ReactElement {
  const theme = useEmotionTheme()
  const { colors, fontSizes, radii, fontWeights } = theme

  const formats = COLUMN_KIND_FORMAT_MAPPING[columnKind] || []

  if (formats.length === 0) {
    // If there are no formats available for the column kind,
    // we don't show the formatting menu option.
    return <></>
  }

  return (
    <Popover
      triggerType={TRIGGER_TYPE.hover}
      returnFocus
      autoFocus
      focusLock
      isOpen={isOpen}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      ignoreBoundary={true}
      content={
        <StyledMenuList role="menu">
          {formats.map(format => (
            <StyledMenuListItem
              key={format.format}
              onClick={() => {
                onChangeFormat(format.format)
                onCloseMenu()
              }}
              role="menuitem"
            >
              <DynamicIcon
                size={"base"}
                margin="0"
                color="inherit"
                iconValue={format.icon}
              />
              {format.label}
            </StyledMenuListItem>
          ))}
        </StyledMenuList>
      }
      placement={PLACEMENT.right}
      showArrow={false}
      popoverMargin={2}
      overrides={{
        Body: {
          props: {
            "data-testid": "stDataFrameColumnFormattingMenu",
          },
          style: {
            borderTopLeftRadius: radii.default,
            borderTopRightRadius: radii.default,
            borderBottomLeftRadius: radii.default,
            borderBottomRightRadius: radii.default,
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
              ? colors.bgColor
              : colors.secondaryBg,
            color: colors.bodyText,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.normal,
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
    >
      {children}
    </Popover>
  )
}

export default memo(FormattingMenu)
