import Clipboard from "clipboard"
import React, { PureComponent, ReactNode, createRef } from "react"
import { Copy as CopyIcon } from "react-feather"
import { StyledCopyButton } from "./styled-components"

interface Props {
  text: string
}

class CopyButton extends PureComponent<Props> {
  private button = createRef<HTMLButtonElement>()

  private clipboard: ClipboardJS | null = null

  public componentDidMount = (): void => {
    const node = this.button.current

    if (node !== null) {
      this.clipboard = new Clipboard(node)
    }
  }

  public componentWillUnmount = (): void => {
    if (this.clipboard !== null) {
      this.clipboard.destroy()
    }
  }

  public render(): ReactNode {
    return (
      <StyledCopyButton
        title="Copy to clipboard"
        ref={this.button}
        data-clipboard-text={this.props.text}
        style={{
          top: 0,
          right: 0,
        }}
      >
        <CopyIcon size="16" />
      </StyledCopyButton>
    )
  }
}

export default CopyButton
