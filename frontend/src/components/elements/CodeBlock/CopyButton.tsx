/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Clipboard from "clipboard"
import React, { ReactElement, useEffect, useRef, useState } from "react"
import { Copy as CopyIcon } from "react-feather"

interface CopyButtonProps {
  text: string
}

export default function CopyButton({ text }: CopyButtonProps): ReactElement {
  const button = useRef<HTMLButtonElement>(null)

  const [clipboard, setClipBoard] = useState<ClipboardJS | null>(null)

  useEffect(() => {
    const node = button.current
    if (node !== null) {
      setClipBoard(new Clipboard(node))
    }
    return () => {
      if (clipboard !== null) {
        clipboard.destroy()
        setClipBoard(null)
      }
    }
  }, [text])

  return (
    <button
      className="overlayBtn"
      title="Copy to clipboard"
      ref={button}
      data-clipboard-text={text}
    >
      <CopyIcon size="16" />
    </button>
  )
}
