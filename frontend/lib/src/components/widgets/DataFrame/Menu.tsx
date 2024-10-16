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
import { ACCESSIBILITY_TYPE, PLACEMENT, Popover } from "baseui/popover"

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme/utils"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { DynamicIcon } from "@streamlit/lib/src/components/shared/Icon"

import { StyledMenuListItem } from "./styled-components"

export interface MenuProps {
  // The top position of the menu.
  top: number
  // The left position of the menu.
  left: number
  // Callback to close the menu
  menuClosed: () => void
  // Callback to hide the column
  hideColumn: () => void
  // Callback to pin the column
  pinColumn: () => void
  // Whether the column is pinned
  isPinned: boolean
  // Callback to unpin the column
  unpinColumn: () => void
}

/**
 *
 * @param top The top position of the tooltip.
 * @param left The left position of the tooltip.
 * @param content The markdown content of the tooltip.
 * @returns The tooltip react element.
 */
function Menu({
  top,
  left,
  menuClosed,
  hideColumn,
  pinColumn,
  isPinned,
  unpinColumn,
}: MenuProps): ReactElement {
  const [open, setOpen] = React.useState(true)
  const theme: EmotionTheme = useTheme()
  const { colors, fontSizes, radii, fontWeights } = theme

  const closeMenu = React.useCallback((): void => {
    setOpen(false)
    menuClosed()
  }, [setOpen, menuClosed])

  return (
    <Popover
      content={
        <div
          style={{
            paddingTop: theme.spacing.xs,
            paddingBottom: theme.spacing.xs,
          }}
        >
          <StyledMenuListItem
            onClick={() => {
              hideColumn()
              closeMenu()
            }}
          >
            <DynamicIcon
              size={"base"}
              margin="0"
              color="inherit"
              iconValue=":material/visibility:"
            />
            Hide column
          </StyledMenuListItem>
          {isPinned && (
            <StyledMenuListItem
              onClick={() => {
                unpinColumn()
                closeMenu()
              }}
            >
              <DynamicIcon
                size={"base"}
                margin="0"
                color="inherit"
                iconValue=":material/keep_off:"
              />
              Unpin column
            </StyledMenuListItem>
          )}
          {!isPinned && (
            <StyledMenuListItem
              onClick={() => {
                pinColumn()
                closeMenu()
              }}
            >
              <DynamicIcon
                size={"base"}
                margin="0"
                color="inherit"
                iconValue=":material/keep:"
              />
              Pin column
            </StyledMenuListItem>
          )}
        </div>
      }
      placement={PLACEMENT.bottomRight}
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      showArrow={false}
      popoverMargin={5}
      onClickOutside={closeMenu}
      onEsc={closeMenu}
      overrides={{
        Body: {
          style: {
            // This is annoying, but a bunch of warnings get logged when the
            // shorthand version `borderRadius` is used here since the long
            // names are used by BaseWeb and mixing the two is apparently
            // bad :(
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
            // See the long comment about `borderRadius`. The same applies here
            // to `padding`.
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
      isOpen={open}
    >
      <div
        data-testid="stDataFrameMenuTarget"
        style={{
          // This is an invisible div that's used to position the tooltip.
          // The position is provided from outside via the `top` and `left` properties.
          // This a workaround for the fact that BaseWeb's Popover  doesn't support
          // positioning to a virtual position and always requires a target
          // component for positioning.
          position: "fixed",
          top,
          left,
        }}
      ></div>
    </Popover>
  )
}

export default Menu
