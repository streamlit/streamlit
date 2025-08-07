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

import React, { memo, ReactElement, useContext, useState } from "react"

import { ExpandLess, ExpandMore } from "@emotion-icons/material-outlined"
import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"

import { Block as BlockProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { StyledIcon } from "~lib/components/shared/Icon"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"

import { StyledPopoverButtonIcon } from "./styled-components"

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
  // TODO (lawilby): This is can probably be simplified if we
  // rewrite the min width calculation to translate rem to px.
  stretchWidth: boolean
}

const Popover: React.FC<React.PropsWithChildren<PopoverProps>> = ({
  element,
  empty,
  children,
  stretchWidth,
}): ReactElement => {
  const [open, setOpen] = useState(false)
  const isInSidebar = useContext(IsSidebarContext)

  const theme = useEmotionTheme()
  const lightBackground = hasLightBackgroundColor(theme)

  // It would be nice to remove this since it uses a resize observer
  // and therefore has a performance overhead. However, this is needed
  // to link the width of the button to the popover width. I think we
  // can remove the need for this as part of the BaseWeb migration.
  const [calculatedWidth, elementRef] = useCalculatedWidth()

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        content={() => children}
        isOpen={open}
        onClickOutside={() => setOpen(false)}
        // We need to handle the click here as well to allow closing the
        // popover when the user clicks next to the button in the available
        // width in the surrounding container.
        onClick={() => (open ? setOpen(false) : undefined)}
        onEsc={() => setOpen(false)}
        ignoreBoundary={isInSidebar}
        // TODO(lukasmasuch): We currently use renderAll to have a consistent
        // width during the first and subsequent opens of the popover. Once we ,
        // support setting an explicit width we should reconsider turning this to
        // false for a better performance.
        renderAll={true}
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
              minWidth: stretchWidth
                ? // If width="stretch", we use the container width as minimum:
                  `${Math.max(calculatedWidth, 160)}px` // 10rem ~= 160px
                : theme.sizes.minPopupWidth,
              [`@media (max-width: ${theme.breakpoints.sm})`]: {
                maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
              },
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              borderBottomRightRadius: theme.radii.xl,
              borderBottomLeftRadius: theme.radii.xl,

              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,

              paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`, // 1px to account for border.
              paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,

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
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <BaseButton
              data-testid="stPopoverButton"
              kind={BaseButtonKind.SECONDARY}
              size={BaseButtonSize.SMALL}
              disabled={empty || element.disabled}
              containerWidth={true}
              onClick={() => setOpen(!open)}
            >
              <DynamicButtonLabel icon={element.icon} label={element.label} />
              <StyledPopoverButtonIcon>
                <StyledIcon
                  as={open ? ExpandLess : ExpandMore}
                  color="inherit"
                  aria-hidden="true"
                  size="lg"
                  margin={theme.spacing.none}
                  padding={theme.spacing.none}
                />
              </StyledPopoverButtonIcon>
            </BaseButton>
          </BaseButtonTooltip>
        </div>
      </UIPopover>
    </Box>
  )
}

export default memo(Popover)
