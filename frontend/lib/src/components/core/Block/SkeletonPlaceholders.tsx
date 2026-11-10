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

import { memo, type ReactElement, type ReactNode } from "react"

import type { Spinner as SpinnerProto, streamlit } from "@streamlit/protobuf"

import { StyledSpinnerTimeText } from "~lib/components/elements/Spinner/styled-components"
import { useElapsedSeconds } from "~lib/components/elements/Spinner/useElapsedSeconds"
import { formatTime } from "~lib/components/elements/Spinner/utils"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { PendingSkeletonContext } from "./PendingSkeletonContext"
import {
  StyledLoadingBlockSkeleton,
  StyledPendingSkeletonOverlay,
  StyledSkeletonLabel,
  StyledSkeletonSurface,
} from "./styled-components"
import type { SkeletonSlot } from "./useSkeletonSlot"

interface SkeletonLabelProps {
  /** The spinner to show on the skeleton as its label. */
  label?: SpinnerProto.$Properties
}

/** A spinner's icon, text, and elapsed time (`show_time`) on a skeleton. */
function SkeletonLabel({
  label,
}: Readonly<SkeletonLabelProps>): ReactElement | null {
  const showTime = label?.showTime === true
  const elapsedSeconds = useElapsedSeconds(showTime)
  if (!label?.text) {
    return null
  }
  return (
    <StyledSkeletonLabel data-testid="stSkeletonLabel">
      <DynamicIcon size="lg" iconValue="spinner" />
      <div role="status">
        <StreamlitMarkdown source={label.text} allowHTML={false} />
      </div>
      {showTime && (
        <StyledSpinnerTimeText>
          {formatTime(elapsedSeconds)}
        </StyledSpinnerTimeText>
      )}
    </StyledSkeletonLabel>
  )
}

/**
 * Covers a slot's previous content, which stays mounted underneath, with a
 * skeleton after the grace period. Like `st.skeleton`, it's hidden from
 * assistive technologies unless it has a label.
 */
export const PendingSkeletonOverlay = memo(function PendingSkeletonOverlay({
  label,
}: Readonly<SkeletonLabelProps>): ReactElement {
  return (
    <StyledPendingSkeletonOverlay
      className="stSkeleton"
      data-testid="stPendingSkeleton"
      aria-hidden={label?.text ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel label={label} />
    </StyledPendingSkeletonOverlay>
  )
})

interface LoadingBlockSkeletonProps extends SkeletonLabelProps {
  heightConfig: streamlit.HeightConfig.$Properties | null | undefined
}

/** The skeleton a loading block shows while it has no content to keep. */
const LoadingBlockSkeleton = memo(function LoadingBlockSkeleton({
  heightConfig,
  label,
}: Readonly<LoadingBlockSkeletonProps>): ReactElement {
  const theme = useEmotionTheme()
  // A stretch skeleton fills its loading block, which the backend stretches.
  const fillsBlock = heightConfig?.useStretch === true
  // Default to the standard element height, like `st.skeleton()`.
  const fixedHeight = heightConfig?.pixelHeight
    ? `${heightConfig.pixelHeight}px`
    : theme.sizes.minElementHeight
  return (
    <StyledLoadingBlockSkeleton
      className="stSkeleton"
      data-testid="stLoadingBlockSkeleton"
      height={fillsBlock ? undefined : fixedHeight}
      $fillsBlock={fillsBlock}
      aria-hidden={label?.text ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel label={label} />
    </StyledLoadingBlockSkeleton>
  )
})

interface SkeletonSlotContentsProps {
  slot: SkeletonSlot
  children: ReactNode
}

/**
 * Render a container's children with its slot's skeleton: inline before them,
 * or as an overlay on top. The context provider always renders, so the
 * children stay mounted when a container becomes a loading block or stops
 * being one.
 */
export function SkeletonSlotContents({
  slot,
  children,
}: Readonly<SkeletonSlotContentsProps>): ReactElement {
  return (
    <>
      {slot.showsInlineSkeleton && (
        <LoadingBlockSkeleton
          heightConfig={slot.skeletonHeight}
          label={slot.label}
        />
      )}
      <PendingSkeletonContext.Provider value={slot.isChildrenPending}>
        {children}
      </PendingSkeletonContext.Provider>
      {slot.showsOverlay && <PendingSkeletonOverlay label={slot.label} />}
    </>
  )
}
