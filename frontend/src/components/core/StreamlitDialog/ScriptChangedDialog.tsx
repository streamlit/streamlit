import {BasicDialog} from 'components/core/StreamlitDialog/StreamlitDialog'
import React, {PureComponent, ReactNode} from 'react'
import {HotKeys} from 'react-hotkeys'
import {Button, ModalBody, ModalFooter, ModalHeader} from 'reactstrap'

export interface Props {
  type: 'scriptChanged';

  /** Called to close the dialog without rerunning the report. */
  onClose: () => void;

  /**
   * Called when the user chooses to re-run the report in response to its source file changing.
   * @param alwaysRerun if true, also change the run-on-save setting for this report
   */
  onRerun: (alwaysRerun: boolean) => void;
}

export class ScriptChangedDialog extends PureComponent<Props> {
  private readonly keyHandlers: { [key: string]: (keyEvent?: KeyboardEvent) => void }

  public constructor(props: Props) {
    super(props)

    this.keyHandlers = {
      'a': this.alwaysRerun,
      'r': this.rerun,
    }
  }

  // TODO: this dialog uses react-hotkeys (and not react-keyboard-shortcuts, our
  // current hotkey library) to handle its hotkeys. react-keyboard-shortcuts doesn't
  // have type definitions, and so can't be used in this file; and it's deficient
  // in a number of other ways.
  // As part of a separate PR, I'd like to migrate the rest of the app away from
  // react-keyboard-shortcuts as well (and remove this comment!)

  public render(): ReactNode {
    return (
      <HotKeys handlers={this.keyHandlers} attach={window}>
        <BasicDialog onClose={this.props.onClose}>
          <ModalHeader toggle={this.props.onClose}>Report changed</ModalHeader>
          <ModalBody>
            <div>The source files for this report have changed on disk.</div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="underlineFirstLetter"
              outline
              color="secondary"
              onClick={this.alwaysRerun}>
              Always rerun
            </Button>
            {' '}
            <Button
              className="underlineFirstLetter"
              outline
              color="primary"
              onClick={this.rerun}>
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
