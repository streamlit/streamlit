/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { PureComponent, ReactNode } from "react"
import { StyledForm } from "./styled-components"

interface Props {
  formId: string
  width: number
  hasSubmitButton: boolean
}

export class Form extends PureComponent<Props> {
  public render = (): ReactNode => {
    return (
      <StyledForm data-testid="stForm" width={this.props.width}>
        {this.props.children}
      </StyledForm>
    )
  }
}
