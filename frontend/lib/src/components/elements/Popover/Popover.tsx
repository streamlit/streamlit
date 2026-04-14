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

import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import styled from "@emotion/styled"
import { mergeProps, useButton, useOverlayTrigger } from "react-aria"
import {
  OverlayTriggerStateContext,
  Provider,
  Popover as RACPopover,
} from "react-aria-components"
import { useOverlayTriggerState } from "react-stately"

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

/** Dialog surface without RAC `Dialog` / `useDialog` so we avoid `useOverlayFocusContain` (full-tree focus trap + inert side effects). */
const PopoverDialogSurface = styled.section({
  margin: 0,
  padding: 0,
  outline: "none",
})

const StreamlitPopoverBody = styled(RACPopover, {
  shouldForwardProp: prop => prop !== "$minWidth",
})<{ $minWidth: string }>(({ theme, $minWidth }) => ({
  ...getPopoverContainerStyle(theme),
  // Portaled popover must sit above the sidebar (z-index ~ header); otherwise
  // stSidebarContent intercepts pointer events (e2e: popover width/columns, dataframe hover).
  zIndex: theme.zIndices.toast,

  borderTopLeftRadius: theme.radii.xl,
  borderTopRightRadius: theme.radii.xl,
  borderBottomRightRadius: theme.radii.xl,
  borderBottomLeftRadius: theme.radii.xl,

  marginRight: theme.spacing.lg,
  marginBottom: theme.spacing.lg,

  maxHeight: "70vh",
  overflow: "auto",
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2*${theme.spacing.lg})`,
  minWidth: $minWidth,

  paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
  },
}))

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
  empty: _empty,
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

  const handleOpenChange = useCallback(
    (newOpen: boolean): void => {
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
    },
    [widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen]
  )

  const overlayState = useOverlayTriggerState({
    isOpen: open,
    onOpenChange: handleOpenChange,
  })
  const overlayStateRef = useRef(overlayState)
  useEffect(() => {
    overlayStateRef.current = overlayState
  }, [overlayState])

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

  const triggerDomRef = useRef<HTMLButtonElement>(null)
  const triggerLabelId = useId()

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    overlayState,
    triggerDomRef
  )

  const { buttonProps } = useButton(triggerProps, triggerDomRef)

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  const popoverMinWidth = stretchWidth
    ? `${Math.max(calculatedWidth, 160)}px`
    : theme.sizes.minPopupWidth

  const dialogSurfaceRef = useRef<HTMLElement | null>(null)
  const streamlitPopoverRef = useRef<HTMLDivElement | null>(null)

  // React Aria's usePopover sets isDismissable=false when isNonModal, so RAC does not
  // attach outside-dismiss. useInteractOutside can fire during the same gesture that
  // opens the popover; register a capture listener only after open so the opening click
  // is never observed as "outside".
  useEffect(() => {
    if (!open) {
      return
    }
    const onDocClickCapture = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (!t) {
        overlayStateRef.current.close()
        return
      }
      if (triggerDomRef.current?.contains(t)) {
        return
      }
      if (streamlitPopoverRef.current?.contains(t)) {
        return
      }
      overlayStateRef.current.close()
    }
    document.addEventListener("click", onDocClickCapture, true)
    return () => document.removeEventListener("click", onDocClickCapture, true)
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      return
    }
    const surface = dialogSurfaceRef.current
    if (!surface) {
      return
    }
    if (!surface.contains(document.activeElement)) {
      surface.focus()
    }
  }, [open])

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <Provider values={[[OverlayTriggerStateContext, overlayState]]}>
        <div>
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <BaseButton
              {...mergeProps(buttonProps, {
                id: triggerLabelId,
                "data-testid": "stPopoverButton",
                kind,
                size: BaseButtonSize.SMALL,
                // Do not gate on `empty`: block-tree `isEmpty` can be true briefly or for
                // nested layouts while body content exists; disabling hides the popover UX
                // and breaks e2e (e.g. width=500px popover in a fixed-height container).
                disabled: element.disabled,
                containerWidth: true,
              })}
              ref={triggerDomRef}
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
        <StreamlitPopoverBody
          ref={streamlitPopoverRef}
          $minWidth={popoverMinWidth}
          triggerRef={triggerDomRef}
          placement="bottom start"
          offset={convertRemToPx(theme.spacing.twoXS)}
          shouldFlip
          isNonModal={true}
          shouldCloseOnInteractOutside={target => {
            const t = triggerDomRef.current
            if (t && (t === target || t.contains(target as Node))) {
              // Let the trigger's toggle handle press; otherwise outside-dismiss runs first
              // and toggle re-opens (last onOpenChange(true)).
              return false
            }
            return true
          }}
          containerPadding={isInSidebar ? 0 : 12}
        >
          <div data-testid="stPopoverBody">
            <PopoverDialogSurface
              ref={dialogSurfaceRef}
              id={overlayProps.id}
              role="dialog"
              tabIndex={-1}
              aria-labelledby={triggerLabelId}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.stopPropagation()
                  overlayState.close()
                }
              }}
            >
              {children}
            </PopoverDialogSurface>
          </div>
        </StreamlitPopoverBody>
      </Provider>
    </Box>
  )
}

export default memo(Popover)
