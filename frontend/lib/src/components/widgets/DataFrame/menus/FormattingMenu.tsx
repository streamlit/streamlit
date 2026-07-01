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

import { memo, ReactElement } from "react"

import { FloatingPortal } from "@floating-ui/react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { useHoverSubmenu } from "~lib/hooks/useHoverSubmenu"

import {
  StyledMenuList,
  StyledMenuListItem,
  StyledSubMenuAnchor,
  StyledSubMenuPanel,
} from "./styled-components"

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
  // A callback when the open state changes (fired by hover interactions).
  onOpenChange: (open: boolean) => void
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
 * @param onOpenChange - Called when hover interactions change the open state.
 * @param onChangeFormat - The function to call when the format changes.
 * @param onCloseMenu - The function to call when the menu is closed.
 * @param children - The menu item that triggers the menu to open.
 */
function FormattingMenu({
  columnKind,
  isOpen,
  onOpenChange,
  onChangeFormat,
  onCloseMenu,
  children,
}: FormattingMenuProps): ReactElement {
  const formats = COLUMN_KIND_FORMAT_MAPPING[columnKind] || []

  const { floatingStyles, setAnchorRef, setFloatingRef } = useHoverSubmenu({
    isOpen,
    onOpenChange,
    enabled: formats.length > 0,
  })

  if (formats.length === 0) {
    // If there are no formats available for the column kind,
    // we don't show the formatting menu option.
    return <></>
  }

  return (
    <>
      <StyledSubMenuAnchor role="presentation" ref={setAnchorRef}>
        {children}
      </StyledSubMenuAnchor>
      {isOpen && (
        <FloatingPortal>
          <StyledSubMenuPanel
            ref={setFloatingRef}
            style={floatingStyles}
            data-testid="stDataFrameColumnFormattingMenu"
            tabIndex={-1}
            autoFocus
          >
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
                  <DynamicIcon size="base" iconValue={format.icon} />
                  {format.label}
                </StyledMenuListItem>
              ))}
            </StyledMenuList>
          </StyledSubMenuPanel>
        </FloatingPortal>
      )}
    </>
  )
}

export default memo(FormattingMenu)
