import React, { PureComponent } from 'react'
import Clipboard from 'clipboard'
import { Copy as CopyIcon } from 'react-feather'
import './CopyToClipboard.scss'

interface Props {
  text: string;
}

class CopyToClipboard extends PureComponent<Props> {
  private copyButton = React.createRef<HTMLButtonElement>()
  private clipboard: (ClipboardJS | null) = null

  componentDidMount = () => {
    const node = this.copyButton.current
    if (node !== null) {
      this.clipboard = new Clipboard(node)
    }
  }

  componentWillUnmount = () => {
    if (this.clipboard !== null) {
      this.clipboard.destroy()
    }
  }

  render = (): React.ReactNode => (
    <button
      ref={this.copyButton}
      title="Click to copy"
      data-clipboard-text={this.props.text}
    >
      <CopyIcon size="16" />
    </button>
  )
}

export default CopyToClipboard
