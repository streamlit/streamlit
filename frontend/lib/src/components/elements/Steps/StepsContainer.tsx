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

import { memo, ReactElement } from "react"

import { Block as BlockProto } from "@streamlit/protobuf"

import { useDetailsAnimation } from "~lib/components/elements/Expander/useDetailsAnimation"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"

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

const StepsContainer: React.FC<
  React.PropsWithChildren<StepsContainerProps>
> = ({ element, isStale, children }): ReactElement => {
  const { label, expanded: initialExpanded } = element
  const hasLabel = label && label.length > 0

  const { isOpen, detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendExpanded: initialExpanded,
      label: label ?? "",
    })

  // Render without label (no collapsible header)
  if (!hasLabel) {
    return (
      <StyledStepsContainer className="stSteps" data-testid="stSteps">
        <StyledStepsList data-testid="stStepsList">{children}</StyledStepsList>
      </StyledStepsContainer>
    )
  }

  // Render with label (collapsible header)
  return (
    <StyledStepsContainer className="stSteps" data-testid="stSteps">
      <StyledStepsDetails isStale={isStale} ref={detailsRef}>
        <StyledStepsSummary
          onClick={handleToggle}
          ref={summaryRef}
          isStale={isStale}
          expanded={isOpen}
        >
          <StyledStepsSummaryHeading>
            <DynamicIcon
              iconValue={
                isOpen
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
          inert={!isOpen ? "" : undefined}
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
