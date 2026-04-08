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

import styled from "@emotion/styled"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { memo, ReactElement, useCallback, useContext, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  Box,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import {
  DynamicIcon,
  isMenuStyleIconLabel,
} from "~lib/components/shared/Icon/DynamicIcon"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { convertRemToPx } from "~lib/theme/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledPopoverExpansionIcon,
  StyledPopoverLabelContainer,
} from "./styled-components"

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
  // TODO (lawilby): This is can probably be simplified if we
  // rewrite the min width calculation to translate rem to px.
  stretchWidth: boolean
  widgetMgr: WidgetStateManager
  /** Block-level ID for CSS key styling and passive persistence. */
  blockId?: string
  fragmentId?: string
}

const StyledPopoverContent = styled(PopoverPrimitive.Content)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),

  borderTopLeftRadius: theme.radii.xl,
  borderTopRightRadius: theme.radii.xl,
  borderBottomRightRadius: theme.radii.xl,
  borderBottomLeftRadius: theme.radii.xl,

  marginRight: theme.spacing.lg,
  marginBottom: theme.spacing.lg,

  maxHeight: "70vh",
  overflow: "auto",
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2*${theme.spacing.lg})`,
  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
  },

  paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
}))

const Popover: React.FC<React.PropsWithChildren<PopoverProps>> = ({
  element,
  empty,
  children,
  stretchWidth,
  widgetMgr,
  blockId,
  fragmentId,
}): ReactElement => {
  const isInSidebar = useContext(IsSidebarContext)

  const theme = useEmotionTheme()

  // id is only set when the backend registers the popover as a
  // stateful widget (on_change="rerun").
  const widgetId = element.id
  const isWidget = Boolean(widgetId)
  const isPassivelyKeyed = Boolean(blockId) && !isWidget

  // Persist open state across remounts via elementStates.
  // The hook is always called (Rules of Hooks) but only effective when
  // isPassivelyKeyed — otherwise the empty id produces a no-op entry.
  const [storedOpen, setStoredOpen] = useWidgetManagerElementState<boolean>({
    widgetMgr,
    id: isPassivelyKeyed ? (blockId ?? "") : "",
    key: "open",
    defaultValue: element.open ?? false,
  })

  const initialOpen = isPassivelyKeyed ? storedOpen : (element.open ?? false)

  // Single state with optimistic updates for instant UI feedback.
  const [open, setOpen] = useState(initialOpen)

  // Sync backend state changes (for programmatic control via session_state).
  // Uses render-time comparison instead of useEffect — no DOM side effects needed.
  useExecuteWhenChanged(() => {
    if (!widgetId || !notNullOrUndefined(element.open)) {
      return
    }
    setOpen(element.open)
  }, [widgetId, element.open])

  // It would be nice to remove this since it uses a resize observer
  // and therefore has a performance overhead. However, this is needed
  // to link the width of the button to the popover width. I think we
  // can remove the need for this as part of the BaseWeb migration.
  const { width: calculatedWidth, elementRef } = useCalculatedDimensions()

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      setOpen(nextOpen)

      if (widgetId) {
        widgetMgr?.setBoolValue(
          { id: widgetId },
          nextOpen,
          { fromUi: true },
          fragmentId
        )
      } else if (isPassivelyKeyed) {
        setStoredOpen(nextOpen)
      }
    },
    [widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen]
  )

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  const sideOffset = convertRemToPx(theme.spacing.twoXS)

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Trigger asChild>
          {/* Wrapper matches prior BaseWeb anchor so BaseButtonTooltip can render a fragment when help is set */}
          <div style={{ width: "100%" }}>
            <BaseButtonTooltip help={element.help} containerWidth={true}>
              <BaseButton
                data-testid="stPopoverButton"
                kind={kind}
                size={BaseButtonSize.SMALL}
                disabled={(empty && !widgetId) || element.disabled}
                containerWidth={true}
              >
                <StyledPopoverLabelContainer $hideChevron={hideChevron}>
                  <DynamicButtonLabel
                    icon={element.icon}
                    label={element.label}
                  />
                  {!hideChevron && (
                    <StyledPopoverExpansionIcon aria-hidden="true">
                      <DynamicIcon
                        iconValue={
                          open
                            ? ":material/expand_less:"
                            : ":material/expand_more:"
                        }
                        size="lg"
                      />
                    </StyledPopoverExpansionIcon>
                  )}
                </StyledPopoverLabelContainer>
              </BaseButton>
            </BaseButtonTooltip>
          </div>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <StyledPopoverContent
            data-testid="stPopoverBody"
            forceMount
            side="bottom"
            align="start"
            sideOffset={sideOffset}
            avoidCollisions={!isInSidebar}
            collisionPadding={sideOffset}
            collisionBoundary={
              typeof document !== "undefined"
                ? document.documentElement
                : undefined
            }
            style={{
              minWidth: stretchWidth
                ? `${Math.max(calculatedWidth, 160)}px`
                : theme.sizes.minPopupWidth,
            }}
          >
            {children}
          </StyledPopoverContent>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </Box>
  )
}

export default memo(Popover)
