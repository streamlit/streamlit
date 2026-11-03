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

import { type CSSProperties, memo, type ReactElement } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"

import {
  StyledLoadingBlockSkeleton,
  StyledPendingSkeletonOverlay,
  StyledSkeletonLabel,
  StyledSkeletonSurface,
} from "./styled-components"

interface SkeletonLabelProps {
  /** Spinner text to show on the skeleton. */
  text?: string
}

/** Spinner icon and text centered on a skeleton. */
function SkeletonLabel({
  text,
}: Readonly<SkeletonLabelProps>): ReactElement | null {
  if (!text) {
    return null
  }
  return (
    <StyledSkeletonLabel data-testid="stSkeletonLabel">
      <DynamicIcon size="lg" iconValue="spinner" />
      <div role="status">
        <StreamlitMarkdown source={text} allowHTML={false} />
      </div>
    </StyledSkeletonLabel>
  )
}

interface PendingSkeletonOverlayProps {
  /** Spinner text to show on the skeleton. */
  label?: string
}

/**
 * Covers a slot's previous content with a skeleton once the grace period has
 * passed. The content stays mounted underneath, so it keeps its state and is
 * updated in place when the new content arrives.
 *
 * The skeleton is decorative, like `st.skeleton`, so it is hidden from
 * assistive technologies unless it carries a label.
 */
export const PendingSkeletonOverlay = memo(function PendingSkeletonOverlay({
  label,
}: Readonly<PendingSkeletonOverlayProps>): ReactElement {
  return (
    <StyledPendingSkeletonOverlay
      className="stSkeleton"
      data-testid="stPendingSkeleton"
      aria-hidden={label ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel text={label} />
    </StyledPendingSkeletonOverlay>
  )
})

interface LoadingBlockSkeletonProps extends PendingSkeletonOverlayProps {
  height: CSSProperties["height"]
}

/** The skeleton a loading block shows while it has no content to keep. */
export const LoadingBlockSkeleton = memo(function LoadingBlockSkeleton({
  height,
  label,
}: Readonly<LoadingBlockSkeletonProps>): ReactElement {
  return (
    <StyledLoadingBlockSkeleton
      className="stSkeleton"
      data-testid="stLoadingBlockSkeleton"
      height={height}
      aria-hidden={label ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel text={label} />
    </StyledLoadingBlockSkeleton>
  )
})
