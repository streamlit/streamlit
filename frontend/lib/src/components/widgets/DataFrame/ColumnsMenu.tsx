/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { useTheme } from "@emotion/react"
import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"
import { Visibility } from "@emotion-icons/material-outlined"

import { List, arrayMove, arrayRemove } from "baseui/dnd-list"
import { ToolbarAction } from "@streamlit/lib/src/components/shared/Toolbar"
import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

export interface ColumnsMenuProps {
  // visibleColumns: string[]
  // hiddenColumns: string[]
}

const ColumnsMenu: React.FC<ColumnsMenuProps> = (): ReactElement => {
  const [open, setOpen] = React.useState(false)

  const [items, setItems] = React.useState(["Item 1", "Item 2", "Item 3"])

  const theme = useTheme()
  const lightBackground = hasLightBackgroundColor(theme)

  return (
    <div data-testid="stPopover" className="stPopover">
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        content={() => (
          <List
            items={items}
            removable
            onChange={({ oldIndex, newIndex }) =>
              setItems(
                newIndex === -1
                  ? arrayRemove(items, oldIndex)
                  : arrayMove(items, oldIndex, newIndex)
              )
            }
            overrides={{
              DragHandle: {
                style: () => ({
                  width: theme.iconSizes.sm,
                }),
              },
              Label: {
                style: () => ({
                  fontSize: theme.fontSizes.sm,
                }),
              },
              Item: {
                style: () => ({
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                  borderTopColor: "transparent",
                  borderBottomColor: "transparent",
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  ":hover": {
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                  },
                }),
              },
              CloseHandle: {
                style: () => ({
                  width: theme.iconSizes.md,
                }),
              },
            }}
          />
        )}
        isOpen={open}
        onClickOutside={() => setOpen(false)}
        // We need to handle the click here as well to allow closing the
        // popover when the user clicks next to the button in the available
        // width in the surrounding container.
        onClick={() => (open ? setOpen(false) : undefined)}
        onEsc={() => setOpen(false)}
        ignoreBoundary={true}
        overrides={{
          Body: {
            props: {
              "data-testid": "stPopoverBody",
            },
            style: () => ({
              marginRight: theme.spacing.lg,
              marginBottom: theme.spacing.lg,

              maxHeight: "70vh",
              overflow: "auto",
              maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2*${theme.spacing.lg})`,
              minWidth: "5rem",
              [`@media (max-width: ${theme.breakpoints.sm})`]: {
                maxWidth: `calc(100% - 2rem)`,
              },
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
              borderBottomRightRadius: theme.radii.lg,
              borderBottomLeftRadius: theme.radii.lg,

              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,

              paddingRight: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`, // 1px to account for border.
              paddingLeft: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
              paddingBottom: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
              paddingTop: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,

              borderLeftStyle: "solid",
              borderRightStyle: "solid",
              borderTopStyle: "solid",
              borderBottomStyle: "solid",

              borderLeftColor: theme.colors.borderColor,
              borderRightColor: theme.colors.borderColor,
              borderTopColor: theme.colors.borderColor,
              borderBottomColor: theme.colors.borderColor,

              boxShadow: lightBackground
                ? "0px 4px 16px rgba(0, 0, 0, 0.16)"
                : "0px 4px 16px rgba(0, 0, 0, 0.7)",
            }),
          },
        }}
      >
        {/* This needs to be wrapped into a div, otherwise
        the BaseWeb popover implementation will not work correctly. */}
        <div>
          <ToolbarAction
            label="Show/hide columns"
            icon={Visibility}
            onClick={() => {
              setOpen(true)
            }}
          />
        </div>
      </UIPopover>
    </div>
  )
}

export default ColumnsMenu
