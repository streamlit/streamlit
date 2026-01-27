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
  FC,
  memo,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import classNames from "classnames"

import { Block as BlockProto } from "@streamlit/protobuf"

import {
  convertKeyToClassName,
  getKeyFromId,
} from "~lib/components/core/Block/utils"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { notNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  BORDER_SIZE,
  StyledDetails,
  StyledDetailsPanel,
  StyledExpandableContainer,
  StyledSummary,
  StyledSummaryHeading,
  StyledSummaryLabelWrapper,
} from "./styled-components"

export interface ExpanderIconProps {
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
export const ExpanderIcon = (props: ExpanderIconProps): ReactElement => {
  const { icon } = props

  const statusIconTestIds: Record<string, string> = {
    ":material/check:": "stExpanderIconCheck",
    ":material/error:": "stExpanderIconError",
    spinner: "stExpanderIconSpinner",
  }

  return icon ? (
    <DynamicIcon
      size="lg"
      iconValue={icon}
      testid={statusIconTestIds[icon] || "stExpanderIcon"}
    />
  ) : (
    <></>
  )
}

export interface ExpanderProps {
  element: BlockProto.Expandable
  isStale: boolean
  widgetMgr?: WidgetStateManager
  blockId?: string
  fragmentId?: string
}

const Expander: FC<PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  widgetMgr,
  blockId,
  fragmentId,
  children,
}): ReactElement => {
  const { label, expanded: backendExpandedState } = element
  const [expanded, setExpanded] = useState<boolean>(
    backendExpandedState || false
  )
  const [isHovered, setIsHovered] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevLabelRef = useRef<string>(label)
  const prevBackendStateRef = useRef<boolean>(backendExpandedState || false)

  const cleanupAnimation = useCallback((): void => {
    if (!detailsRef.current) {
      return
    }

    animationRef.current = null
    detailsRef.current.style.height = ""
    detailsRef.current.style.overflow = ""
  }, [])

  const onToggleAnimationFinish = useCallback(
    (open: boolean): void => {
      if (!detailsRef.current) {
        return
      }

      detailsRef.current.open = open
      cleanupAnimation()
    },
    [cleanupAnimation]
  )

  const onResizeAnimationFinish = useCallback((): void => {
    // For content height adjustments, we only clean up styles
    // Don't change the open state - expander is already open
    cleanupAnimation()
  }, [cleanupAnimation])

  const createAnimation = useCallback(
    (
      detailsEl: HTMLDetailsElement,
      startHeight: number,
      endHeight: number,
      onFinish: () => void
    ): void => {
      if (animationRef.current) {
        animationRef.current.cancel()

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      const animation = detailsEl.animate(
        {
          height: [`${startHeight}px`, `${endHeight}px`],
        },
        {
          duration: 500,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        }
      )

      animation.addEventListener("finish", onFinish)
      animationRef.current = animation
    },
    []
  )

  const toggleAnimation = useCallback(
    (
      detailsEl: HTMLDetailsElement,
      startHeight: number,
      endHeight: number
    ): void => {
      const isOpen = endHeight > startHeight
      createAnimation(detailsEl, startHeight, endHeight, () =>
        onToggleAnimationFinish(isOpen)
      )
    },
    [createAnimation, onToggleAnimationFinish]
  )

  const resizeAnimation = useCallback(
    (
      detailsEl: HTMLDetailsElement,
      startHeight: number,
      endHeight: number
    ): void => {
      createAnimation(
        detailsEl,
        startHeight,
        endHeight,
        onResizeAnimationFinish
      )
    },
    [createAnimation, onResizeAnimationFinish]
  )

  useEffect(() => {
    // Only apply the expanded state if it was actually set in the proto.
    if (notNullOrUndefined(backendExpandedState)) {
      const labelChanged = label !== prevLabelRef.current

      // Cancel animations ONLY if label changed (different expander instance)
      // Don't cancel for same expander with state changes
      if (labelChanged) {
        if (animationRef.current) {
          animationRef.current.cancel()
          animationRef.current = null
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      // Detect if backend state value changed (for widget mode animation)
      const backendStateChanged =
        prevBackendStateRef.current !== undefined &&
        backendExpandedState !== prevBackendStateRef.current

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing with backend state
      setExpanded(backendExpandedState)

      // We manage the open attribute via the detailsRef and not with React state
      // Don't set it if we're about to animate (animation will handle it)
      if (detailsRef.current && !backendStateChanged) {
        detailsRef.current.open = backendExpandedState
      }

      // Animate for widget mode when backend state changes
      if (backendStateChanged && detailsRef.current && summaryRef.current) {
        const detailsEl = detailsRef.current

        detailsEl.style.overflow = "hidden"
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
        const detailsHeight = detailsEl.getBoundingClientRect().height
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
        const summaryHeight = summaryRef.current.getBoundingClientRect().height

        if (backendExpandedState) {
          // Backend says expand - animate open
          detailsEl.style.height = `${detailsHeight}px`
          detailsEl.open = true

          window.requestAnimationFrame(() => {
            toggleAnimation(
              detailsEl,
              detailsHeight,
              summaryHeight + 2 * BORDER_SIZE + 5
            )

            timeoutRef.current = setTimeout(() => {
              if (!contentRef.current) {
                return
              }

              const contentHeight =
                // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
                contentRef.current.getBoundingClientRect().height
              toggleAnimation(
                detailsEl,
                detailsHeight,
                summaryHeight + contentHeight + 2 * BORDER_SIZE
              )
            }, 100)
          })
        } else {
          // Backend says collapse - animate closed
          toggleAnimation(
            detailsEl,
            detailsHeight,
            summaryHeight + 2 * BORDER_SIZE
          )
        }
      }

      // Update trackers
      prevLabelRef.current = label
      prevBackendStateRef.current = backendExpandedState
    }

    // Having `label` in the dependency array here is necessary because
    // sometimes two distinct expanders look so similar that even the react
    // diffing algorithm decides that they're the same element with updated
    // props (this happens when something in the app removes one expander and
    // replaces it with another in the same position).
    //
    // By adding `label` as a dependency, we ensure that we reset the
    // expander's `expanded` state in this edge case.
  }, [label, backendExpandedState, toggleAnimation])

  // Handle content arriving after expander is already expanded
  // This happens when content takes time to compute on the backend
  useEffect(() => {
    if (
      contentRef.current &&
      detailsRef.current &&
      summaryRef.current &&
      detailsRef.current.open // Check DOM state, not React state (avoids stale state)
    ) {
      const detailsEl = detailsRef.current

      // Get current height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
      const currentHeight = detailsEl.getBoundingClientRect().height

      // Get new content height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
      const contentHeight = contentRef.current.getBoundingClientRect().height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
      const summaryHeight = summaryRef.current.getBoundingClientRect().height
      const targetHeight = summaryHeight + contentHeight + 2 * BORDER_SIZE

      // If height difference is significant, animate to new height
      if (Math.abs(currentHeight - targetHeight) > 5) {
        detailsEl.style.overflow = "hidden"
        resizeAnimation(detailsEl, currentHeight, targetHeight)
      }
    }
  }, [children, expanded, resizeAnimation])

  const toggle = (e: MouseEvent<HTMLDetailsElement>): void => {
    e.preventDefault()

    const newExpanded = !expanded

    // Check if this is a widget (has widgetMgr and blockId)
    const isWidget = widgetMgr && blockId

    if (isWidget) {
      // Widget mode (on_change="rerun"): Send to backend and wait for response
      // Don't update local state or start animation here
      // The animation will be triggered in useEffect when backend state changes
      widgetMgr.setBoolValue(
        { id: blockId },
        newExpanded,
        { fromUi: true },
        fragmentId
      )
    } else {
      // Non-widget mode (on_change="ignore"): Animate immediately
      // Backend won't send updated state, so handle locally
      setExpanded(newExpanded)

      const detailsEl = detailsRef.current
      if (!detailsEl || !summaryRef.current) {
        return
      }

      detailsEl.style.overflow = "hidden"
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
      const detailsHeight = detailsEl.getBoundingClientRect().height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
      const summaryHeight = summaryRef.current.getBoundingClientRect().height

      if (newExpanded) {
        detailsEl.style.height = `${detailsHeight}px`
        detailsEl.open = true

        window.requestAnimationFrame(() => {
          // For expansion animations, we rely on the rendered width and height
          // of the children content. However, in Safari, the children are not
          // rendered because Safari doesn't paint elements that are not visible
          // (in this case, the details element is not visible because it's
          // not open). This operation produces inconsistent heights to animate.
          // To work around this, we force a repaint by animating a tiny bit
          // and animate the rest of it later.
          toggleAnimation(
            detailsEl,
            detailsHeight,
            summaryHeight + 2 * BORDER_SIZE + 5 // Arbitrary size of 5px
          )

          timeoutRef.current = setTimeout(() => {
            if (!contentRef.current) {
              return
            }

            const contentHeight =
              // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
              contentRef.current.getBoundingClientRect().height
            toggleAnimation(
              detailsEl,
              detailsHeight,
              summaryHeight + contentHeight + 2 * BORDER_SIZE
            )
          }, 100)
        })
      } else {
        toggleAnimation(
          detailsEl,
          detailsHeight,
          summaryHeight + 2 * BORDER_SIZE
        )
      }
    }
  }

  const handleMouseEnter = (): void => {
    setIsHovered(true)
  }

  const handleMouseLeave = (): void => {
    setIsHovered(false)
  }

  // Determine which icon to show
  const showChevron = !element.icon || isHovered
  const showUserIcon = element.icon && !isHovered

  const userKey = getKeyFromId(blockId)

  return (
    <StyledExpandableContainer
      className={classNames("stExpander", convertKeyToClassName(userKey))}
      data-testid="stExpander"
    >
      <StyledDetails
        isStale={isStale}
        ref={detailsRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <StyledSummary
          onClick={toggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={expanded}
        >
          <StyledSummaryHeading>
            {showChevron && (
              <DynamicIcon
                iconValue={
                  expanded
                    ? ":material/keyboard_arrow_down:"
                    : ":material/keyboard_arrow_right:"
                }
                size="lg"
              />
            )}
            {showUserIcon && <ExpanderIcon icon={element.icon} />}

            <StyledSummaryLabelWrapper>
              <StreamlitMarkdown
                source={label}
                allowHTML={false}
                isLabel
                largerLabel
              />
            </StyledSummaryLabelWrapper>
          </StyledSummaryHeading>
        </StyledSummary>
        <StyledDetailsPanel data-testid="stExpanderDetails" ref={contentRef}>
          {children}
        </StyledDetailsPanel>
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default memo(Expander)
