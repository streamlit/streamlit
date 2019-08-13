import {
  BasicDialog,
  DialogType,
} from 'components/core/StreamlitDialog/StreamlitDialog'
import React, {PureComponent, ReactNode} from 'react'
import {HotKeys} from 'react-hotkeys'
import {Button, ModalBody, ModalFooter, ModalHeader} from 'reactstrap'

export interface Props {
  type: DialogType.SCRIPT_CHANGED;

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
