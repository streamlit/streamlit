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

import { memo, ReactElement, useCallback, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StepIconTone,
  StyledDetails,
  StyledDetailsPanel,
  StyledExpandableContainer,
  StyledStepChevron,
  StyledStepConnector,
  StyledStepHeader,
  StyledStepIcon,
  StyledStepIconColumn,
  StyledSummary,
  StyledSummaryHeading,
  StyledSummaryLabelWrapper,
  StyledVisuallyHidden,
} from "./styled-components"
import { useDetailsAnimation } from "./useDetailsAnimation"

const STATUS_ICON_TEST_IDS: Record<string, string> = {
  ":material/check:": "stExpanderIconCheck",
  ":material/error:": "stExpanderIconError",
  spinner: "stExpanderIconSpinner",
}

const { State, Type } = BlockProto.Expandable

interface StepIcon {
  iconValue: string
  tone: StepIconTone
}

interface StepState extends StepIcon {
  /** Progress state as announced to screen readers. */
  stateLabel: string
}

/** How a step renders each progress state of an st.status. */
const STEP_STATES: Partial<Record<BlockProto.Expandable.State, StepState>> = {
  [State.RUNNING]: {
    iconValue: "spinner",
    tone: "muted",
    stateLabel: "running",
  },
  [State.COMPLETE]: {
    iconValue: ":material/check_circle:",
    tone: "muted",
    stateLabel: "complete",
  },
  [State.ERROR]: {
    iconValue: ":material/error:",
    tone: "error",
    stateLabel: "error",
  },
}

/** Neutral placeholder for a step that has neither a state nor a user icon. */
const DEFAULT_STEP_ICON = ":material/circle:"

/**
 * Resolves the icon and tone a step shows while it is neither hovered nor
 * focused.
 *
 * The state wins over `icon` because only `st.status` sets a state and it has
 * no `icon` parameter, while only `st.expander` accepts an `icon`. `st.status`
 * additionally encodes its state into `icon` for the default and compact
 * styles, so reading `icon` first would pin steps to that icon set.
 */
function resolveStepIcon(
  stepState: StepState | undefined,
  icon: string
): StepIcon {
  if (stepState) {
    return stepState
  }
  return icon
    ? { iconValue: icon, tone: "default" }
    : { iconValue: DEFAULT_STEP_ICON, tone: "muted" }
}

interface ExpanderIconProps {
  icon?: string
}

/**
 * Renders an icon for the expander and optionally a user-defined icon.
 *
 * If the icon is "spinner", it will render a spinner icon.
 * If the icon is a valid, user-defined icon, it will render the user-defined icon.
 * Otherwise, it will render nothing.
 *
 * @param {string} icon - The icon to render.
 * @returns {ReactElement}
 */
const ExpanderIcon = (props: ExpanderIconProps): ReactElement => {
  const { icon } = props

  return icon ? (
    <DynamicIcon
      size="base"
      iconValue={icon}
      testid={STATUS_ICON_TEST_IDS[icon] || "stExpanderIcon"}
    />
  ) : (
    <></>
  )
}

export interface ExpanderProps {
  element: BlockProto.Expandable
  isStale: boolean
  /** True when the block has no children; a step without content can't collapse. */
  empty: boolean
  widgetMgr: WidgetStateManager
  /** Block-level ID for CSS key styling (may be set without widget mode). */
  blockId?: string
  fragmentId?: string
}

const Expander: React.FC<React.PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  empty,
  widgetMgr,
  blockId,
  fragmentId,
  children,
}): ReactElement => {
  const { label, icon, type, state } = element
  const [isHovered, setIsHovered] = useState(false)

  // element.id is only set when the backend registers the expander as a
  // stateful widget (on_change="rerun"). block.id may still be set for
  // CSS key styling without implying widget mode.
  const widgetId = element.id || undefined
  const isWidget = Boolean(widgetMgr && widgetId)
  const isPassivelyKeyed = Boolean(blockId) && !isWidget

  // Persist expanded state across remounts via elementStates.
  // The hook is always called (Rules of Hooks) but only effective when
  // isPassivelyKeyed — otherwise the empty id produces a no-op entry.
  const [storedExpanded, setStoredExpanded] =
    useWidgetManagerElementState<boolean>({
      widgetMgr,
      id: isPassivelyKeyed ? (blockId ?? "") : "",
      key: "expanded",
      defaultValue: element.expanded ?? false,
    })

  const initialExpanded = isPassivelyKeyed ? storedExpanded : element.expanded

  // Sync widget manager state when the backend programmatically changes the
  // expanded value (e.g. st.session_state.key = False). Without this, the
  // widget manager retains the stale value and sends it back on the next
  // rerun, causing the expander to revert to its old state.
  useExecuteWhenChanged(() => {
    if (!widgetId || !notNullOrUndefined(element.expanded)) {
      return
    }
    widgetMgr.setBoolValue(widgetId, element.expanded, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  }, [widgetId, element.expanded])

  // Callback to notify backend of toggle (only used in widget mode)
  const handleWidgetToggle = useCallback(
    (newOpen: boolean): void => {
      if (widgetMgr && widgetId) {
        widgetMgr.setBoolValue(widgetId, newOpen, {
          formId: undefined,
          fragmentId,
          fromUser: true,
        })
      }
    },
    [widgetMgr, widgetId, fragmentId]
  )

  // Callback for passive persistence (only when passively keyed)
  const handlePersistToggle = useCallback(
    (newOpen: boolean): void => {
      setStoredExpanded(newOpen)
    },
    [setStoredExpanded]
  )

  const onToggle = isWidget
    ? handleWidgetToggle
    : isPassivelyKeyed
      ? handlePersistToggle
      : undefined

  const isCompact = type === Type.COMPACT
  const isStep = type === Type.STEP
  // Only the default style draws a border, which also counts towards the
  // height the expand/collapse animation targets.
  const hasBorder = type === Type.DEFAULT
  // A step without content has nothing to reveal, so it stays a plain header.
  const isCollapsible = !isStep || !empty

  // Compact + shimmer: the sweep is the in-progress cue (see compact summary
  // styles). A leading spinner next to it is a second loading indicator on an
  // already-minimal header.
  const hideCompactSpinnerForShimmer =
    isCompact && icon === "spinner" && label.includes(":shimmer[")

  // Leading icon logic: normal mode swaps between chevron and user icon on hover;
  // compact mode always shows user icon (if any) since the chevron is trailing.
  const showLeadingChevron = !isCompact && (!icon || isHovered)
  const showLeadingUserIcon = isCompact
    ? Boolean(icon) && !hideCompactSpinnerForShimmer
    : icon && !isHovered

  const { isOpen, detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendExpanded: initialExpanded,
      label,
      onToggle,
      hasBorder,
    })

  const handleMouseEnter = (): void => {
    setIsHovered(true)
  }

  const handleMouseLeave = (): void => {
    setIsHovered(false)
  }

  const stepState = STEP_STATES[state]
  const stepIcon = resolveStepIcon(stepState, icon)
  const stepStateLabel = isStep ? stepState?.stateLabel : undefined

  const summaryHeading = (
    <StyledSummaryHeading expanderType={type}>
      {isStep ? (
        // The icon and chevron only restate what the hidden state text and
        // aria-expanded already convey, and Material icons would otherwise leak
        // their ligature name into the accessible name.
        <StyledStepIconColumn aria-hidden="true">
          <StyledStepIcon
            tone={stepIcon.tone}
            data-testid="stExpanderStepIcon"
          >
            <DynamicIcon iconValue={stepIcon.iconValue} size="lg" />
          </StyledStepIcon>
          {isCollapsible && (
            <StyledStepChevron data-testid="stExpanderStepChevron">
              <DynamicIcon
                iconValue={
                  isOpen
                    ? ":material/keyboard_arrow_down:"
                    : ":material/keyboard_arrow_right:"
                }
                size="lg"
              />
            </StyledStepChevron>
          )}
        </StyledStepIconColumn>
      ) : (
        <>
          {showLeadingChevron && (
            <DynamicIcon
              iconValue={
                isOpen
                  ? ":material/keyboard_arrow_down:"
                  : ":material/keyboard_arrow_right:"
              }
              size="base"
            />
          )}
          {showLeadingUserIcon && <ExpanderIcon icon={icon} />}
        </>
      )}

      <StyledSummaryLabelWrapper expanderType={type}>
        <StreamlitMarkdown source={label} allowHTML={false} isLabel />
      </StyledSummaryLabelWrapper>

      {/* Append the state as hidden text rather than setting an aria-label:
          this keeps the rendered markdown label as the accessible name, and it
          also reaches non-collapsible steps, which ignore aria-label. */}
      {stepStateLabel && (
        <StyledVisuallyHidden>{` — ${stepStateLabel}`}</StyledVisuallyHidden>
      )}

      {/* Trailing chevron for compact mode (uses chevron_right for tighter appearance) */}
      {isCompact && (
        <DynamicIcon
          iconValue={
            isOpen
              ? ":material/keyboard_arrow_down:"
              : ":material/chevron_right:"
          }
          size="lg"
        />
      )}
    </StyledSummaryHeading>
  )

  if (!isCollapsible) {
    return (
      <StyledExpandableContainer
        className="stExpander"
        data-testid="stExpander"
        expanderType={type}
      >
        <StyledStepHeader isStale={isStale}>{summaryHeading}</StyledStepHeader>
      </StyledExpandableContainer>
    )
  }

  return (
    <StyledExpandableContainer
      className="stExpander"
      data-testid="stExpander"
      expanderType={type}
    >
      {isStep && <StyledStepConnector data-testid="stExpanderStepConnector" />}
      <StyledDetails
        isStale={isStale}
        hasBorder={hasBorder}
        ref={detailsRef}
        // A step swaps its icon for the chevron in CSS, so tracking hover in
        // state would only cost it a render per pointer enter and leave.
        onMouseEnter={isStep ? undefined : handleMouseEnter}
        onMouseLeave={isStep ? undefined : handleMouseLeave}
      >
        <StyledSummary
          onClick={handleToggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={isOpen}
          expanderType={type}
          // Only steps set aria-expanded explicitly: a step shows a status icon
          // and swaps in a chevron only on hover or focus, so its open state has
          // no persistent visual indicator. The value also reports the state the
          // user just asked for, ahead of `details.open`, which lags by the
          // collapse animation. Default and compact keep the native <details>
          // mapping.
          aria-expanded={isStep ? isOpen : undefined}
        >
          {summaryHeading}
        </StyledSummary>
        <StyledDetailsPanel
          data-testid="stExpanderDetails"
          ref={contentRef}
          expanderType={type}
          // Exclude collapsed content from browser find-in-page (Cmd+F) searches.
          // Using "" instead of true for consistent behavior in jsdom tests.
          inert={!isOpen ? "" : undefined}
        >
          {children}
        </StyledDetailsPanel>
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default memo(Expander)
