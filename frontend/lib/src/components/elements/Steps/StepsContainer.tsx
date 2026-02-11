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

import { memo, ReactElement, useEffect, useRef, useState } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { notNullOrUndefined } from "~lib/util/utils"

import {
  StyledStepsContainer,
  StyledStepsDetails,
  StyledStepsList,
  StyledStepsPanel,
  StyledStepsSummary,
  StyledStepsSummaryHeading,
  StyledStepsSummaryLabelWrapper,
} from "./styled-components"

export interface StepsContainerProps {
  element: BlockProto.StepsContainer
  isStale: boolean
}

const BORDER_SIZE = 1 // px

const StepsContainer: React.FC<
  React.PropsWithChildren<StepsContainerProps>
> = ({ element, isStale, children }): ReactElement => {
  const { label, expanded: initialExpanded } = element
  const hasLabel = label && label.length > 0

  // If there's no label, always render expanded content directly
  if (!hasLabel) {
    return (
      <StyledStepsContainer className="stSteps" data-testid="stSteps">
        <StyledStepsList data-testid="stStepsList">{children}</StyledStepsList>
      </StyledStepsContainer>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- conditional but safe since hasLabel is stable
  const [expanded, setExpanded] = useState<boolean>(initialExpanded ?? true)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const detailsRef = useRef<HTMLDetailsElement>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const summaryRef = useRef<HTMLElement>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const animationRef = useRef<Animation | null>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const contentRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (notNullOrUndefined(initialExpanded)) {
      setExpanded(initialExpanded)

      if (detailsRef.current) {
        detailsRef.current.open = initialExpanded
      }
    }
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

    setExpanded(!expanded)
    const detailsEl = detailsRef.current
    if (!detailsEl || !summaryRef.current) {
      return
    }

    detailsEl.style.overflow = "hidden"
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
    const detailsHeight = detailsEl.getBoundingClientRect().height
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
    const summaryHeight = summaryRef.current.getBoundingClientRect().height

    if (!expanded) {
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
      toggleAnimation(
        detailsEl,
        detailsHeight,
        summaryHeight + 2 * BORDER_SIZE
      )
    }
  }

  return (
    <StyledStepsContainer className="stSteps" data-testid="stSteps">
      <StyledStepsDetails isStale={isStale} ref={detailsRef}>
        <StyledStepsSummary
          onClick={toggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={expanded}
        >
          <StyledStepsSummaryHeading>
            <DynamicIcon
              iconValue={
                expanded
                  ? ":material/keyboard_arrow_down:"
                  : ":material/keyboard_arrow_right:"
              }
              size="lg"
            />

            <StyledStepsSummaryLabelWrapper>
              <StreamlitMarkdown
                source={label}
                allowHTML={false}
                isLabel
                largerLabel
              />
            </StyledStepsSummaryLabelWrapper>
          </StyledStepsSummaryHeading>
        </StyledStepsSummary>
        <StyledStepsPanel
          data-testid="stStepsDetails"
          ref={contentRef}
          inert={!expanded ? "" : undefined}
        >
          <StyledStepsList data-testid="stStepsList">
            {children}
          </StyledStepsList>
        </StyledStepsPanel>
      </StyledStepsDetails>
    </StyledStepsContainer>
  )
}

export default memo(StepsContainer)
