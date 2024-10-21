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

import React, { ReactElement } from "react"

import { Info } from "@emotion-icons/material-outlined"

import Checkmark from "@streamlit/app/src/assets/svg/checkmark.svg"
import { Icon } from "@streamlit/lib"

import { StyledElement } from "./styled-components"

export interface IDeployListElementProps {
  children?: React.ReactNode
  extraSpacing?: boolean
  infoIcon?: boolean
}

function DeployListElement(props: IDeployListElementProps): ReactElement {
  const { children, infoIcon } = props
  return (
    <StyledElement>
      {infoIcon ? (
        <Icon content={Info} />
      ) : (
        <img src={Checkmark} alt={"Checkmark"} />
      )}
      <span>{children}</span>
    </StyledElement>
  )
}

export default DeployListElement
