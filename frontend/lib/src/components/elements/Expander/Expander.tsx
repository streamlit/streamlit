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

import React, { ReactElement, useEffect, useRef, useState } from "react"

import { ExpandLess, ExpandMore } from "@emotion-icons/material-outlined"

import { Block as BlockProto } from "@streamlit/lib/src/proto"
import {
  DynamicIcon,
  StyledIcon,
  StyledSpinnerIcon,
} from "@streamlit/lib/src/components/shared/Icon"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import { IconSize, isPresetTheme } from "@streamlit/lib/src/theme"

import {
  BORDER_SIZE,
  StyledDetails,
  StyledDetailsPanel,
  StyledExpandableContainer,
  StyledSummary,
  StyledSummaryHeading,
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
  const { activeTheme } = React.useContext(LibContext)

  const iconProps = {
    size: "lg" as IconSize,
    margin: "0",
    padding: "0",
  }

  const statusIconTestIds: Record<string, string> = {
    ":material/check:": "stExpanderIconCheck",
    ":material/error:": "stExpanderIconError",
  }

  if (icon === "spinner") {
    const usingCustomTheme = !isPresetTheme(activeTheme)
    return (
      <StyledSpinnerIcon
        usingCustomTheme={usingCustomTheme}
        data-testid="stExpanderIconSpinner"
        {...iconProps}
      />
    )
  }

  return icon ? (
    <DynamicIcon
      color="inherit"
      iconValue={icon}
      testid={statusIconTestIds[icon] || "stExpanderIcon"}
      {...iconProps}
    />
  ) : (
    <></>
  )
}

export interface ExpanderProps {
  element: BlockProto.Expandable
  isStale: boolean
  empty: boolean
}

const Expander: React.FC<React.PropsWithChildren<ExpanderProps>> = ({
  element,
  isStale,
  empty,
  children,
}): ReactElement => {
  const { label, expanded: initialExpanded } = element
  const [expanded, setExpanded] = useState<boolean>(initialExpanded || false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only apply the expanded state if it was actually set in the proto.
    if (notNullOrUndefined(initialExpanded)) {
      setExpanded(initialExpanded)

      // We manage the open attribute via the detailsRef and not with React state
      if (detailsRef.current) {
        detailsRef.current.open = initialExpanded
      }
    }

    // Having `label` in the dependency array here is necessary because
    // sometimes two distinct expanders look so similar that even the react
    // diffing algorithm decides that they're the same element with updated
    // props (this happens when something in the app removes one expander and
    // replaces it with another in the same position).
    //
    // By adding `label` as a dependency, we ensure that we reset the
    // expander's `expanded` state in this edge case.
  }, [label, initialExpanded])

  const onAnimationFinish = (open: boolean): void => {
    if (!detailsRef.current) {
      return
    }

    detailsRef.current.open = open
    animationRef.current = null
    detailsRef.current.style.height = ""
    detailsRef.current.style.overflow = ""
  }

  const toggleAnimation = (
    detailsEl: HTMLDetailsElement,
    startHeight: number,
    endHeight: number
  ): void => {
    const isOpen = endHeight > startHeight

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

    animation.addEventListener("finish", () => onAnimationFinish(isOpen))
    animationRef.current = animation
  }

  const toggle = (e: React.MouseEvent<HTMLDetailsElement>): void => {
    e.preventDefault()
    if (empty) {
      return
    }

    setExpanded(!expanded)
    const detailsEl = detailsRef.current
    if (!detailsEl || !summaryRef.current) {
      return
    }

    detailsEl.style.overflow = "hidden"
    const detailsHeight = detailsEl.getBoundingClientRect().height
    const summaryHeight = summaryRef.current.getBoundingClientRect().height

    if (!expanded) {
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

  return (
    <StyledExpandableContainer className="stExpander" data-testid="stExpander">
      <StyledDetails isStale={isStale} ref={detailsRef}>
        <StyledSummary onClick={toggle} empty={empty} ref={summaryRef}>
          <StyledSummaryHeading>
            {element.icon && <ExpanderIcon icon={element.icon} />}
            <StreamlitMarkdown source={label} allowHTML={false} isLabel />
          </StyledSummaryHeading>
          {!empty ? (
            <StyledIcon
              as={expanded ? ExpandLess : ExpandMore}
              color={"inherit"}
              aria-hidden="true"
              data-testid="stExpanderToggleIcon"
              size="lg"
              margin=""
              padding=""
            />
          ) : (
            <></>
          )}
        </StyledSummary>
        {!empty ? (
          <StyledDetailsPanel data-testid="stExpanderDetails" ref={contentRef}>
            {children}
          </StyledDetailsPanel>
        ) : (
          <></>
        )}
      </StyledDetails>
    </StyledExpandableContainer>
  )
}

export default Expander
