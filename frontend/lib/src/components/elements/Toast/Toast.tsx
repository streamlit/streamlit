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

import { memo, type ReactElement, useEffect, useRef } from "react"

import type { QueuedToast } from "react-aria-components/Toast"

import type { Toast as ToastProto } from "@streamlit/protobuf"
import { isNullOrUndefined } from "@streamlit/utils"

import AlertElement from "~lib/components/elements/AlertElement/AlertElement"
import { Kind } from "~lib/components/shared/AlertContainer/AlertContainer"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { type StreamlitToastContent, toastQueue } from "./toastQueue"

/** Auto-hide timeout used when the toast has no explicit duration. */
const DEFAULT_TIMEOUT_MS = 4_000

/**
 * Converts the proto `duration` (seconds) to a react-aria timeout (ms). A
 * duration of 0 means "until dismissed", which react-aria expresses as no
 * timeout.
 */
function getToastTimeout(
  duration: number | null | undefined
): number | undefined {
  if (isNullOrUndefined(duration)) {
    return DEFAULT_TIMEOUT_MS
  }
  return duration === 0 ? undefined : duration * 1_000
}

/** Whether a queued toast already shows this body, icon, and timeout. */
function hasSameContent(
  toast: QueuedToast<StreamlitToastContent>,
  { body, icon }: StreamlitToastContent,
  timeout: number | undefined
): boolean {
  return (
    toast.content.body === body &&
    toast.content.icon === icon &&
    toast.timeout === timeout
  )
}

export interface ToastProps {
  element: ToastProto
  /**
   * Stable identity of this toast (its delta path). Toasts at the same position
   * across reruns share a `toastId`; distinct `st.toast()` calls do not.
   */
  toastId: string
}

function Toast({
  element,
  toastId,
}: Readonly<ToastProps>): ReactElement | null {
  const { body } = element
  const icon = element.icon || undefined
  const timeout = getToastTimeout(element.duration)
  const theme = useEmotionTheme()
  /**
   * Whether this instance has already synced its toast to the queue. Only the
   * first sync may add a toast; later syncs (`msg.toast()` updates within the
   * same run) only replace a visible one, so they never revive a toast that
   * already expired or was dismissed.
   */
  const hasSyncedRef = useRef(false)

  useEffect(() => {
    if (theme.inSidebar) {
      return
    }

    const isFirstSync = !hasSyncedRef.current
    hasSyncedRef.current = true

    const content: StreamlitToastContent = { body, icon, toastId }

    // Toasts are identified by position: a rerun remounts this component
    // (it is keyed by scriptRunId) with the same toastId, and msg.toast()
    // updates the props of this same instance. Distinct st.toast() calls live
    // at distinct delta paths, so they don't affect each other.
    //
    // Caveat: toastId is the delta path, which is a *position* in the shared
    // EVENT container (toasts and dialogs are interleaved there by call order).
    // If the EVENT elements emitted before a toast change across reruns (e.g. a
    // conditional st.toast() or st.dialog, or a toast from a callback or a
    // fragment run) while the toast is still visible, toasts shift positions:
    // a shifted toast can briefly show as a duplicate, or close the toast
    // visible at its new position early. Identifying toasts by their
    // parameters would avoid this but would also collapse
    // intentionally-identical toasts (e.g. the "Three cheers" example).
    const existing = toastQueue.visibleToasts.find(
      toast => toast.content.toastId === toastId
    )

    if (existing) {
      // Same content: keep the visible toast and its running timer. This
      // covers an unconditional st.toast() re-emitted on rerun and StrictMode
      // replaying this effect on mount.
      if (hasSameContent(existing, content, timeout)) {
        return
      }
      // New content (a msg.toast() update, or a rerun emitting different
      // content at this position): replace the toast, since react-aria's
      // queue has no in-place update. The replacement restarts the timer with
      // the new duration and shows as the newest toast in the stack.
      toastQueue.close(existing.key)
    } else if (!isFirstSync) {
      // Don't revive a toast that expired or was dismissed before this
      // update arrived.
      return
    }

    // Intentionally no unmount cleanup: a toast's lifetime is governed by its
    // react-aria timeout (or manual dismissal), not the React component
    // lifecycle. This lets a toast survive the stale-node unmount that happens
    // when st.toast() is immediately followed by st.rerun() (issue #7740).
    toastQueue.add(content, { timeout })
  }, [body, icon, timeout, toastId, theme.inSidebar])

  const sidebarErrorMessage = (
    <AlertElement
      kind={Kind.ERROR}
      body="Streamlit API Error: `st.toast` cannot be called directly on the sidebar with `st.sidebar.toast`.
        See our `st.toast` API [docs](https://docs.streamlit.io/develop/api-reference/status/st.toast) for more information."
    />
  )

  return theme.inSidebar ? sidebarErrorMessage : null
}

export default memo(Toast)
