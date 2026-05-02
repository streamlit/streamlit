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

import { memo, ReactElement, useCallback, useContext, useState } from "react"

import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"

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

  // Handle popover toggle with optimistic updates
  const handleToggle = useCallback((): void => {
    const newOpen = !open

    setOpen(newOpen)

    if (widgetId) {
      widgetMgr?.setBoolValue(
        { id: widgetId },
        newOpen,
        { fromUi: true },
        fragmentId
      )
    } else if (isPassivelyKeyed) {
      setStoredOpen(newOpen)
    }
  }, [open, widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen])

  const handleClose = useCallback((): void => {
    setOpen(false)

    if (widgetId) {
      widgetMgr?.setBoolValue(
        { id: widgetId },
        false,
        { fromUi: true },
        fragmentId
      )
    } else if (isPassivelyKeyed) {
      setStoredOpen(false)
    }
  }, [widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen])

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        content={() => children}
        isOpen={open}
        onClickOutside={handleClose}
        // We need to handle the click here as well to allow closing the
        // popover when the user clicks next to the button in the available
        // width in the surrounding container.
        onClick={() => (open ? handleClose() : undefined)}
        onEsc={handleClose}
        ignoreBoundary={isInSidebar}
        popoverMargin={convertRemToPx(theme.spacing.twoXS)}
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
              ...getPopoverContainerStyle(theme),

              // Override radii — st.popover uses xl instead of default
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              borderBottomRightRadius: theme.radii.xl,
              borderBottomLeftRadius: theme.radii.xl,

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

              paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`, // 1px to account for border.
              paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
              paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
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
              kind={kind}
              size={BaseButtonSize.SMALL}
              disabled={(empty && !widgetId) || element.disabled}
              containerWidth={true}
              onClick={handleToggle}
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
      </UIPopover>
    </Box>
  )
}

export default memo(Popover)
