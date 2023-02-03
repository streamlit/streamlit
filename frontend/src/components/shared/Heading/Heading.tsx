/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, {
  ReactElement,
  ReactNode,
  HTMLProps,
  FunctionComponent,
  Fragment,
} from "react"

import { once } from "lodash"
import { Link as LinkIcon } from "react-feather"
import { ReactMarkdownProps } from "react-markdown/lib/ast-to-react"
import { RenderedMarkdown } from "src/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import AppContext from "src/components/core/AppContext"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"
import { Heading as HeadingProto } from "src/autogen/proto"

import { StyledStreamlitMarkdown } from "src/components/shared/StreamlitMarkdown/styled-components"

import {
  StyledLinkIconContainer,
  StyledLinkIcon,
  StyledHeaderContent,
  StyledHeaderContainer,
} from "./styled-components"

enum Tags {
  H1 = "h1",
  H2 = "h2",
  H3 = "h3",
}

/**
 * Creates a slug suitable for use as an anchor given a string.
 * Splits the string on non-alphanumeric characters, and joins with a dash.
 */
export function createAnchorFromText(text: string | null): string {
  const newAnchor = text
    ?.toLowerCase()
    .split(/[^A-Za-z0-9]/)
    .filter(Boolean)
    .join("-")
  return newAnchor || ""
}

// wrapping in `once` ensures we only scroll once
const scrollNodeIntoView = once((node: HTMLElement): void => {
  node.scrollIntoView(true)
})

interface HeadingWithAnchorProps {
  tag: string
  anchor?: string
  children: ReactNode[] | ReactNode
  tagProps?: HTMLProps<HTMLHeadingElement>
}

export const HeadingWithAnchor: FunctionComponent<HeadingWithAnchorProps> = ({
  tag,
  anchor: propsAnchor,
  children,
  tagProps,
}) => {
  const isSidebar = React.useContext(IsSidebarContext)
  const [elementId, setElementId] = React.useState(propsAnchor)
  const [target, setTarget] = React.useState<HTMLElement | null>(null)

  const { addScriptFinishedHandler, removeScriptFinishedHandler } =
    React.useContext(AppContext)
  if (isSidebar) {
    return React.createElement(tag, tagProps, children)
  }

  const onScriptFinished = React.useCallback(() => {
    if (target !== null) {
      // wait a bit for everything on page to finish loading
      window.setTimeout(() => {
        scrollNodeIntoView(target)
      }, 300)
    }
  }, [target])

  React.useEffect(() => {
    addScriptFinishedHandler(onScriptFinished)
    return () => {
      removeScriptFinishedHandler(onScriptFinished)
    }
  }, [addScriptFinishedHandler, removeScriptFinishedHandler, onScriptFinished])

  const ref = React.useCallback(
    node => {
      if (node === null) {
        return
      }

      const anchor = propsAnchor || createAnchorFromText(node.textContent)
      setElementId(anchor)
      if (window.location.hash.slice(1) === anchor) {
        setTarget(node)
      }
    },
    [propsAnchor]
  )

  return React.createElement(
    tag,
    { ...tagProps, ref, id: elementId },
    <StyledLinkIconContainer>
      {elementId && (
        <StyledLinkIcon href={`#${elementId}`}>
          <LinkIcon size="18" />
        </StyledLinkIcon>
      )}
      <StyledHeaderContent>{children}</StyledHeaderContent>
    </StyledLinkIconContainer>
  )
}

type HeadingProps = JSX.IntrinsicElements["h1"] &
  ReactMarkdownProps & { level: number; "data-anchor"?: string }

export const CustomHeading: FunctionComponent<HeadingProps> = ({
  node,
  children,
  level,
  ...rest
}) => {
  const anchor = rest["data-anchor"]
  return (
    <StyledHeaderContainer>
      <HeadingWithAnchor tag={node.tagName} anchor={anchor} tagProps={rest}>
        {children}
      </HeadingWithAnchor>
    </StyledHeaderContainer>
  )
}

export function makeMarkdownHeading(tag: string, markdown: string): string {
  switch (tag.toLowerCase()) {
    case Tags.H1: {
      return `# ${markdown}`
    }
    case Tags.H2: {
      return `## ${markdown}`
    }
    case Tags.H3: {
      return `### ${markdown}`
    }
    default: {
      throw new Error(`Unrecognized tag for header: ${tag}`)
    }
  }
}

export interface HeadingProtoProps {
  width: number
  element: HeadingProto
}

export function Heading(props: HeadingProtoProps): ReactElement {
  const { width } = props
  const { tag, anchor, body } = props.element
  const isSidebar = React.useContext(IsSidebarContext)
  // st.header can contain new lines which are just interpreted as new
  // markdown to be rendered as such.
  const [heading, ...rest] = body.split("\n")

  return (
    <div className="stMarkdown" style={{ width }}>
      <StyledStreamlitMarkdown
        isCaption={Boolean(false)}
        isInSidebar={isSidebar}
        style={{ width }}
        data-testid="stMarkdownContainer"
      >
        <StyledHeaderContainer>
          <HeadingWithAnchor tag={tag} anchor={anchor}>
            <RenderedMarkdown
              source={makeMarkdownHeading(tag, heading)}
              allowHTML={false}
              // this is purely an inline string
              overrideComponents={{
                p: Fragment,
                h1: Fragment,
                h2: Fragment,
                h3: Fragment,
                h4: Fragment,
                h5: Fragment,
                h6: Fragment,
              }}
            />
          </HeadingWithAnchor>
        </StyledHeaderContainer>
        {/* Only the first line of the body is used as a heading, the remaining text is added as regular mardkown below. */}
        {rest.length > 0 && (
          <RenderedMarkdown source={rest.join("\n")} allowHTML={false} />
        )}
      </StyledStreamlitMarkdown>
    </div>
  )
}

export default Heading
