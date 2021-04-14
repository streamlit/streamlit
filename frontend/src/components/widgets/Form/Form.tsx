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

import React, { PureComponent, ReactElement, ReactNode } from "react"
import Alert from "src/components/elements/Alert"
import { Kind } from "src/components/shared/AlertContainer"
import { Timer } from "src/lib/Timer"
import { StyledForm, StyledErrorContainer } from "./styled-components"

export interface Props {
  formId: string
  width: number
  hasSubmitButton: boolean
}

interface State {
  // Set to true when our 'submitButtonWarningTimer' expires and we
  // don't have a submit button.
  submitButtonTimeout: boolean
}

/**
 * If the form doesn't have a submit button after this many milliseconds
 * have elapsed, we show a warning that tells them they probably want to
 * create one.
 */
export const SUBMIT_BUTTON_ERROR_TIME_MS = 1500

export const MISSING_SUBMIT_BUTTON_ERROR =
  "**Missing submit button**" +
  "\n\nThis form has no submit button, which means that user interactions will " +
  "never be sent to your Streamlit app." +
  "\n\nTo create a submit button, use the `st.submit_button()` function." +
  "\n\nFor more information, refer to the " +
  "[documentation for forms](https://docs.streamlit.io/api.html#form)."

export class Form extends PureComponent<Props, State> {
  private readonly submitButtonWarningTimer = new Timer()

  private submitButtonWarningFormId?: string

  public constructor(props: Props) {
    super(props)
    this.state = { submitButtonTimeout: false }
  }

  public componentDidMount = (): void => {
    this.updateSubmitButtonWarningTimer()
  }

  public componentDidUpdate = (): void => {
    this.updateSubmitButtonWarningTimer()
  }

  public componentWillUnmount = (): void => {
    this.submitButtonWarningTimer.cancel()
  }

  public render = (): ReactNode => {
    let submitWarning: ReactElement | undefined
    if (!this.props.hasSubmitButton && this.state.submitButtonTimeout) {
      submitWarning = (
        <StyledErrorContainer>
          <Alert
            body={MISSING_SUBMIT_BUTTON_ERROR}
            kind={Kind.ERROR}
            width={this.props.width}
          />
        </StyledErrorContainer>
      )
    }

    return (
      <StyledForm data-testid="stForm" width={this.props.width}>
        {this.props.children}
        {submitWarning}
      </StyledForm>
    )
  }

  private updateSubmitButtonWarningTimer = (): void => {
    if (this.props.hasSubmitButton) {
      // The submit button was created. Cancel the timer if it's running.
      this.submitButtonWarningTimer.cancel()
      this.submitButtonWarningFormId = undefined
      return
    }

    if (this.submitButtonWarningFormId === this.props.formId) {
      // The timer is already running, so no need to do anything.
      return
    }

    // Start a timer. If it expires and the form doesn't yet have a submit
    // button, we'll warn the user that they probably want to create one.
    this.setState({ submitButtonTimeout: false })
    this.submitButtonWarningTimer.setTimeout(
      () => this.setState({ submitButtonTimeout: true }),
      SUBMIT_BUTTON_ERROR_TIME_MS
    )
    this.submitButtonWarningFormId = this.props.formId
  }
}
