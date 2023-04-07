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

import React, { Fragment, ReactElement } from "react"
import IsSidebarContext from "src/components/core/Sidebar/IsSidebarContext"

import {
  StyledHeaderContainer,
  StyledStreamlitMarkdown,
} from "./styled-components"

import "katex/dist/katex.min.css"
import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "src/components/shared/TooltipIcon"
import {
  HeadingProtoProps,
  HeadingWithAnchor,
  RenderedMarkdown,
  Tags,
} from "./StreamlitMarkdown"

function makeMarkdownHeading(tag: string, markdown: string): string {
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

function Heading(props: HeadingProtoProps): ReactElement {
  const { width, element } = props
  const { tag, anchor, body, help, hideAnchor } = element
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
          <HeadingWithAnchor tag={tag} anchor={anchor} hideAnchor={hideAnchor}>
            {help ? (
              <StyledLabelHelpWrapper>
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
                <InlineTooltipIcon content={help} />
              </StyledLabelHelpWrapper>
            ) : (
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
            )}
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
