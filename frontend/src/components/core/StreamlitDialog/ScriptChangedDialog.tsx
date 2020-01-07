/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { BasicDialog } from "components/core/StreamlitDialog/StreamlitDialog"
import React, { PureComponent, ReactNode } from "react"
import { HotKeys } from "react-hotkeys"
import { Button, ModalBody, ModalFooter, ModalHeader } from "reactstrap"

export interface Props {
  /** Called to close the dialog without rerunning the report. */
  onClose: () => void

  /**
   * Called when the user chooses to re-run the report in response to its source file changing.
   * @param alwaysRerun if true, also change the run-on-save setting for this report
   */
  onRerun: (alwaysRerun: boolean) => void
}

export class ScriptChangedDialog extends PureComponent<Props> {
  private readonly keyHandlers: {
    [key: string]: (keyEvent?: KeyboardEvent) => void
  }

  constructor(props: Props) {
    super(props)

    this.keyHandlers = {
      a: this.alwaysRerun,
      // No handler for 'r' since it's handled by app.jsx and precedence
      // isn't working when multiple components handle the same key
      // 'r': this.rerun,
    }
  }

  public render(): ReactNode {
    // Not sure exactly why attach and focused are necessary on the
    // HotKeys component here but its not working without them
    return (
      <HotKeys handlers={this.keyHandlers} attach={window} focused={true}>
        <BasicDialog onClose={this.props.onClose}>
          <ModalHeader toggle={this.props.onClose}>App changed</ModalHeader>
          <ModalBody>
            <div>The source files for this app have changed on disk.</div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="underlineFirstLetter"
              outline
              color="secondary"
              onClick={this.alwaysRerun}
            >
              Always rerun
            </Button>{" "}
            <Button
              className="underlineFirstLetter"
              outline
              color="primary"
              onClick={this.rerun}
            >
              Rerun
            </Button>
          </ModalFooter>
        </BasicDialog>
      </HotKeys>
    )
  }

  private rerun = (): void => {
    this.props.onRerun(false)
  }

  private alwaysRerun = (): void => {
    this.props.onRerun(true)
  }
}
