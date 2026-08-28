/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { Fragment, ReactElement, useContext } from "react"

import { Components } from "react-markdown"

import { Heading as HeadingProto } from "@streamlit/protobuf"

import IsDialogContext from "~lib/components/core/IsDialogContext"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  HeadingWithActionElements,
  RenderedMarkdown,
  Tags,
} from "./StreamlitMarkdown"
import {
  StyledHeaderDivider,
  StyledHeadingIcon,
  StyledStreamlitMarkdown,
} from "./styled-components"

import "katex/dist/katex.min.css"

export interface HeadingProtoProps {
  element: HeadingProto
}

function makeMarkdownHeading(tag: string, markdown: string): string {
  switch (tag.toLowerCase()) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- TODO: Fix this
    case Tags.H1: {
      return `# ${markdown}`
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- TODO: Fix this
    case Tags.H2: {
      return `## ${markdown}`
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- TODO: Fix this
    case Tags.H3: {
      return `### ${markdown}`
    }
    default: {
      throw new Error(`Unrecognized tag for header: ${tag}`)
    }
  }
}

const OVERRIDE_COMPONENTS: Components = {
  p: Fragment,
  h1: Fragment,
  h2: Fragment,
  h3: Fragment,
  h4: Fragment,
  h5: Fragment,
  h6: Fragment,
}

function Heading(props: HeadingProtoProps): ReactElement {
  const { element } = props
  const { tag, anchor, body, help, hideAnchor, divider, icon } = element
  const isInDialog = useContext(IsDialogContext)
  const flexContext = useContext(FlexContext)
  const truncate = element.wrap === false
  // Heading bodies may contain newlines. Render the first line as the heading
  // and, when wrapping is enabled, render the remainder as Markdown below it.
  // With wrap=false the extra lines are dropped so the element stays one line tall.
  const [heading, ...rest] = body.split("\n")

  // Render the icon as an inline sibling of the body text instead of
  // prepending `:material/name:` to the markdown source: this keeps
  // wrapping and text_alignment identical to a markdown icon, keeps the
  // glyph out of the accessible name and auto-anchor, and also supports
  // "spinner", which has no markdown equivalent.
  const headingIcon = icon ? (
    <StyledHeadingIcon aria-hidden="true">
      <DynamicIcon iconValue={icon} size="inherit" testid="stHeadingIcon" />
    </StyledHeadingIcon>
  ) : undefined

  return (
    <div className="stHeading" data-testid="stHeading">
      {/* Truncation CSS lives on HeadingWithActionElements. Applying it here
          would flatten the heading to display:inline and clip help icons. */}
      <StyledStreamlitMarkdown
        isCaption={Boolean(false)}
        isInDialog={isInDialog}
        isInHorizontalLayout={flexContext?.isInHorizontalLayout}
        data-testid="stMarkdownContainer"
      >
        <HeadingWithActionElements
          anchor={anchor}
          help={help}
          hideAnchor={hideAnchor}
          tag={tag}
          icon={headingIcon}
          truncate={truncate}
        >
          <RenderedMarkdown
            allowHTML={false}
            source={makeMarkdownHeading(tag, heading)}
            // this is purely an inline string
            overrideComponents={OVERRIDE_COMPONENTS}
          />
        </HeadingWithActionElements>
        {/* wrap=false keeps only the first line; extra body lines would otherwise render as markdown below. */}
        {!truncate && rest.length > 0 && (
          <RenderedMarkdown source={rest.join("\n")} allowHTML={false} />
        )}
      </StyledStreamlitMarkdown>
      {divider && (
        <StyledHeaderDivider
          data-testid="stHeadingDivider"
          rainbow={divider.includes("linear")}
          color={divider}
        />
      )}
    </div>
  )
}

export default Heading
