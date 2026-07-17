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

import { memo, ReactElement, useEffect } from "react"

import { Toast as ToastProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import AlertElement from "~lib/components/elements/AlertElement/AlertElement"
import { Kind } from "~lib/components/shared/AlertContainer/AlertContainer"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { toastQueue } from "./toastQueue"

export interface ToastProps {
  element: ToastProto
}

function Toast({ element }: Readonly<ToastProps>): ReactElement {
  const { body, icon, duration } = element
  const theme = useEmotionTheme()

  useEffect(() => {
    if (theme.inSidebar) {
      return
    }

    // duration=null/undefined → 4s default; duration=0 → undefined (persistent); duration>0 → ms
    const timeout = notNullOrUndefined(duration)
      ? duration === 0
        ? undefined
        : duration * 1_000
      : 4_000

    const key = toastQueue.add({ body, icon: icon || undefined }, { timeout })

    return () => {
      toastQueue.close(key)
    }

    // Mount/unmount only — Streamlit creates a new Toast element per st.toast() call;
    // the component never receives updated props for the same toast instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sidebarErrorMessage = (
    <AlertElement
      kind={Kind.ERROR}
      body="Streamlit API Error: `st.toast` cannot be called directly on the sidebar with `st.sidebar.toast`.
        See our `st.toast` API [docs](https://docs.streamlit.io/develop/api-reference/status/st.toast) for more information."
    />
  )

  return <>{theme.inSidebar && sidebarErrorMessage}</>
}

export default memo(Toast)
