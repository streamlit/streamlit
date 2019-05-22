import React, { PureComponent } from 'react'
import Clipboard from 'clipboard'
import { Copy as CopyIcon } from 'react-feather'
import './CopyButton.scss'

interface Props {
  text: string;
}

class CopyButton extends PureComponent<Props> {
  private button = React.createRef<HTMLButtonElement>()
  private clipboard: (ClipboardJS | null) = null

  public componentDidMount = () => {
    const node = this.button.current
    if (node !== null) {
      this.clipboard = new Clipboard(node)
    }
  }

  public componentWillUnmount = () => {
    if (this.clipboard !== null) {
      this.clipboard.destroy()
    }
  }

  public render = (): React.ReactNode => (
    <button
      ref={this.button}
      title="Click to copy"
      className="copy"
      data-clipboard-text={this.props.text}
    >
      <CopyIcon size="16" />
    </button>
  )
}

export default CopyButton
