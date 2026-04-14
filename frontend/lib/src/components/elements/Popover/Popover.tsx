/** @jsxImportSource @emotion/react */
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
  useMemo,
  useRef,
  useState,
} from "react"

import { css, type SerializedStyles } from "@emotion/react"
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react"

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
import type { EmotionTheme } from "~lib/theme/types"
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

function getPopoverBodyStyles(
  theme: EmotionTheme,
  stretchWidth: boolean,
  calculatedWidth: number
): SerializedStyles {
  return css({
    zIndex: theme.zIndices.popup,
    boxSizing: "border-box",
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
    minWidth: stretchWidth
      ? `${Math.max(calculatedWidth, 160)}px`
      : theme.sizes.minPopupWidth,

    [`@media (max-width: ${theme.breakpoints.sm})`]: {
      maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
    },

    paddingRight: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
    paddingLeft: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
    paddingBottom: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
    paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
  })
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

  const handleCloseRef = useRef<() => void>(() => {})
  /** Portal into this node so `stPopoverBody` stays under `stPopover` (e2e + query scoping). */
  const portalRootRef = useRef<HTMLDivElement>(null)

  const persistCloseState = useCallback((): void => {
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

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: next => {
      if (!next) {
        handleCloseRef.current()
      }
    },
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(convertRemToPx(theme.spacing.twoXS)),
      flip({
        boundary: isInSidebar ? document.documentElement : undefined,
      }),
      shift({ padding: convertRemToPx(theme.spacing.sm) }),
    ],
  })

  const handleClose = useCallback((): void => {
    const floatEl = refs.floating.current
    const active = document.activeElement
    if (
      floatEl &&
      active &&
      floatEl.contains(active) &&
      active instanceof HTMLElement
    ) {
      active.blur()
    }

    // Close in the same task as blur() so `open` stays true until after native blur runs.
    // Deferring with setTimeout(0) could hide the body (visibility) before Base Web inputs
    // finish onBlur, dropping the last committed widget value (e2e popover + text_input).
    setOpen(false)
    persistCloseState()
  }, [refs.floating, persistCloseState])

  useEffect(() => {
    handleCloseRef.current = handleClose
  }, [handleClose])

  // Handle popover toggle with optimistic updates (after useFloating so refs exist).
  const handleToggle = useCallback((): void => {
    const newOpen = !open

    if (!newOpen) {
      const floatEl = refs.floating.current
      const active = document.activeElement
      if (
        floatEl &&
        active &&
        floatEl.contains(active) &&
        active instanceof HTMLElement
      ) {
        active.blur()
      }
      setOpen(false)
      persistCloseState()
      return
    }

    setOpen(true)

    if (widgetId) {
      widgetMgr?.setBoolValue(
        { id: widgetId },
        true,
        { fromUi: true },
        fragmentId
      )
    } else if (isPassivelyKeyed) {
      setStoredOpen(true)
    }
  }, [
    open,
    widgetMgr,
    widgetId,
    fragmentId,
    isPassivelyKeyed,
    setStoredOpen,
    refs.floating,
    persistCloseState,
  ])

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  })

  const role = useRole(context, { role: "dialog" })

  const { getFloatingProps } = useInteractions([dismiss, role])

  const bodyCss = useMemo(
    () => getPopoverBodyStyles(theme, stretchWidth, calculatedWidth),
    [theme, stretchWidth, calculatedWidth]
  )

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  return (
    <Box
      data-testid="stPopover"
      className="stPopover"
      ref={elementRef}
      style={{ position: "relative" }}
    >
      <div ref={refs.setReference}>
        <BaseButtonTooltip help={element.help} containerWidth={true}>
          <BaseButton
            data-testid="stPopoverButton"
            kind={kind}
            size={BaseButtonSize.SMALL}
            disabled={(empty && !widgetId) || element.disabled}
            containerWidth={true}
            onClick={handleToggle}
            aria-expanded={open}
          >
            <StyledPopoverLabelContainer $hideChevron={hideChevron}>
              <DynamicButtonLabel icon={element.icon} label={element.label} />
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
      <div
        ref={portalRootRef}
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
      />
      {/* Always mount body (BaseWeb renderAll): keep widgets in the tree on close so blur commits. */}
      <FloatingPortal root={portalRootRef}>
        <FloatingFocusManager
          context={context}
          modal={false}
          initialFocus={-1}
          returnFocus={false}
          guards={false}
          disabled={!open}
        >
          <div
            // eslint-disable-next-line react-hooks/refs -- @floating-ui floating ref setter
            ref={refs.setFloating}
            data-testid="stPopoverBody"
            css={bodyCss}
            style={{
              ...floatingStyles,
              ...(!open && {
                visibility: "hidden",
                pointerEvents: "none",
              }),
            }}
            {...getFloatingProps()}
          >
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    </Box>
  )
}

export default memo(Popover)
