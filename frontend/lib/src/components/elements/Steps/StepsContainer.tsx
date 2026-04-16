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

import { StyledStepsContainer, StyledStepsList } from "./styled-components"

interface StepsContainerProps {
  element: BlockProto.StepsContainer
  isStale: boolean
}

const StepsContainer: React.FC<
  React.PropsWithChildren<StepsContainerProps>
> = ({ children }): ReactElement => {
  return (
    <StyledStepsContainer className="stSteps" data-testid="stSteps">
      <StyledStepsList data-testid="stStepsList">{children}</StyledStepsList>
    </StyledStepsContainer>
  )
}

export default memo(StepsContainer)
