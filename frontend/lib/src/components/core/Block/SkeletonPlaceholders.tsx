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

import {
  type CSSProperties,
  memo,
  type ReactElement,
  type ReactNode,
} from "react"

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
  /** The spinner to show on the skeleton. */
  spinner?: SpinnerProto.$Properties
}

/**
 * A spinner's icon, text, and elapsed time (`show_time`) centered on a
 * skeleton.
 */
function SkeletonLabel({
  spinner,
}: Readonly<SkeletonLabelProps>): ReactElement | null {
  const showTime = spinner?.showTime === true
  const elapsedSeconds = useElapsedSeconds(showTime)
  if (!spinner?.text) {
    return null
  }
  return (
    <StyledSkeletonLabel data-testid="stSkeletonLabel">
      <DynamicIcon size="lg" iconValue="spinner" />
      <div role="status">
        <StreamlitMarkdown source={spinner.text} allowHTML={false} />
      </div>
      {showTime && (
        <StyledSpinnerTimeText>
          {formatTime(elapsedSeconds)}
        </StyledSpinnerTimeText>
      )}
    </StyledSkeletonLabel>
  )
}

interface PendingSkeletonOverlayProps {
  /** The spinner to show on the skeleton as its label. */
  label?: SpinnerProto.$Properties
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
      aria-hidden={label?.text ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel spinner={label} />
    </StyledPendingSkeletonOverlay>
  )
})

/**
 * Convert a loading block's fixed skeleton height to CSS. Without a height,
 * the skeleton uses the standard element height, like `st.skeleton()`.
 */
function getSkeletonHeight(
  heightConfig: streamlit.HeightConfig.$Properties | null | undefined,
  defaultHeight: string
): CSSProperties["height"] {
  if (heightConfig?.pixelHeight) {
    return `${heightConfig.pixelHeight}px`
  }
  if (heightConfig?.remHeight) {
    return `${heightConfig.remHeight}rem`
  }
  return defaultHeight
}

interface LoadingBlockSkeletonProps extends PendingSkeletonOverlayProps {
  heightConfig: streamlit.HeightConfig.$Properties | null | undefined
}

/** The skeleton a loading block shows while it has no content to keep. */
const LoadingBlockSkeleton = memo(function LoadingBlockSkeleton({
  heightConfig,
  label,
}: Readonly<LoadingBlockSkeletonProps>): ReactElement {
  const theme = useEmotionTheme()
  // A stretch skeleton fills its loading block, which the backend also
  // stretches.
  const fillsBlock = heightConfig?.useStretch === true
  return (
    <StyledLoadingBlockSkeleton
      className="stSkeleton"
      data-testid="stLoadingBlockSkeleton"
      height={
        fillsBlock
          ? undefined
          : getSkeletonHeight(heightConfig, theme.sizes.minElementHeight)
      }
      $fillsBlock={fillsBlock}
      aria-hidden={label?.text ? undefined : true}
    >
      <StyledSkeletonSurface />
      <SkeletonLabel spinner={label} />
    </StyledLoadingBlockSkeleton>
  )
})

interface SkeletonSlotContentsProps {
  /** The container's skeleton state, from `useSkeletonSlot`. */
  slot: SkeletonSlot
  /** The container's children. */
  children: ReactNode
}

/**
 * Render a container's children with the skeleton of its slot: the inline
 * skeleton before them, or the overlay on top of them.
 *
 * The context provider is always rendered, so the children keep their place
 * in the React tree, and stay mounted, when a container becomes a loading
 * block or stops being one.
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
