import React, { ReactElement, ReactNode, FunctionComponent } from "react"
import { ReactMarkdownProps } from "react-markdown/src/ast-to-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"

import CopyButton from "./CopyButton"
import {
  StyledPre,
  StyledCodeBlock,
  StyledCopyButtonContainer,
} from "./styled-components"

export type CodeTagProps = JSX.IntrinsicElements["code"] &
  ReactMarkdownProps & { inline?: boolean }

export interface CodeBlockProps {
  node?: ReactNode
  children: ReactNode
}

/**
 * Renders code tag with highlighting based on requested language.
 */
export const CodeTag: FunctionComponent<CodeTagProps> = ({
  node,
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || "")
  const codeText = String(children)
    .trim()
    .replace(/\n$/, "")

  return !inline ? (
    <>
      {codeText && (
        <StyledCopyButtonContainer>
          <CopyButton text={codeText} />
        </StyledCopyButtonContainer>
      )}
      <StyledPre>
        <SyntaxHighlighter
          language={(match && match[1]) || ""}
          PreTag="div"
          customStyle={{ backgroundColor: "transparent" }}
          style={{}}
        >
          {codeText}
        </SyntaxHighlighter>
      </StyledPre>
    </>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

/**
 * Renders a code block with syntax highlighting, via Prismjs
 */
export default function CodeBlock({
  children,
}: Record<any, any>): ReactElement {
  return <StyledCodeBlock className="stCodeBlock">{children}</StyledCodeBlock>
}
