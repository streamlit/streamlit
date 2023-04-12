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

import React, { ReactElement, useEffect, useRef, useState } from "react"
import { ILanguageInfo } from "src/autogen/proto"
import {
  SelectedLanguageRoot,
  SelectedLanguagePrefix,
} from "./styled-components"
import Button, { Kind, Size } from "src/components/shared/Button"
import { ButtonGroup } from "baseui/button-group"

export interface ILanguagePickerProps {
  languageInfo: ILanguageInfo | null
  sendLoadLanguageInfoBackMsg: (changeLanguage?: string | null) => void
}

export function LanguagePicker(props: ILanguagePickerProps): ReactElement {
  const [language, setLanguage] = useState<string>("")
  const [hovered, setHovered] = useState<boolean>(false)

  const ref: any = useRef<HTMLDivElement>(null)

  function isEventInElement(
    event: MouseEvent,
    element: HTMLDivElement
  ): boolean {
    const rect = element.getBoundingClientRect()
    const x = event.clientX
    if (x < rect.left || x >= rect.right) return false
    const y = event.clientY
    return !(y < rect.top || y >= rect.bottom)
  }

  const clearCollapseHandler = (): void => {
    if (window.languagePickerCollapseHandler) {
      try {
        clearTimeout(window.languagePickerCollapseHandler)
      } catch (err) {}
    }
    window.languagePickerCollapseHandler = null
  }

  const handleMouseMove = (evt: MouseEvent): void => {
    const qs = document.getElementsByClassName("selectedLanguageRoot")
    if (qs.length < 1) return
    const el = qs[0]
    if (isEventInElement(evt, el as HTMLDivElement)) {
      clearCollapseHandler()
    } else if (!window.languagePickerCollapseHandler) {
      window.languagePickerCollapseHandler = setTimeout(() => {
        if (!window.languagePickerHold) {
          setHovered(false)
        }
      }, 1000)
    }
  }

  const handleMouseOver = (): void => {
    setHovered(true)
  }

  useEffect(() => {
    const node: any = ref.current
    if (node) {
      node.addEventListener("mouseover", handleMouseOver)
      window.addEventListener("mousemove", handleMouseMove)
      return () => {
        node.removeEventListener("mouseover", handleMouseOver)
        window.removeEventListener("mousemove", handleMouseMove)
      }
    }
  })

  const { languageInfo, sendLoadLanguageInfoBackMsg } = props
  if (!languageInfo) {
    sendLoadLanguageInfoBackMsg()
  }
  const languages = languageInfo?.availableLanguages
    ?.filter(language => {
      return (
        language.standardizedTag !==
        languageInfo?.sessionLanguage?.standardizedTag
      )
    })
    .map(language => {
      return (
        <Button
          key={language.standardizedTag}
          kind={Kind.SECONDARY}
          size={Size.XSMALL}
          onClick={() => {
            window.languagePickerHold = false
            clearCollapseHandler()
            setHovered(false)
            if (language.standardizedTag) {
              setLanguage(language.standardizedTag)
              sendLoadLanguageInfoBackMsg(language.standardizedTag)
            }
          }}
        >
          {language.standardizedTag}
        </Button>
      )
    })
  if (languageInfo?.sessionLanguage?.standardizedTag && !language) {
    setLanguage(languageInfo?.sessionLanguage?.standardizedTag)
  }
  return languages && languages.length > 1 ? (
    <SelectedLanguageRoot ref={ref} className="selectedLanguageRoot">
      <ButtonGroup
        overrides={{
          Root: {
            style: { flexWrap: "wrap" },
          },
        }}
      >
        {hovered && languages && languages.length > 0 ? languages : null}
        <Button
          key={languageInfo?.sessionLanguage?.standardizedTag}
          kind={Kind.SECONDARY}
          size={Size.XSMALL}
          onClick={() => {
            if (!window.languagePickerHold) {
              window.languagePickerHold = true
              clearCollapseHandler()
            } else if (window.languagePickerHold === true) {
              window.languagePickerHold = false
              clearCollapseHandler()
              setHovered(false)
            }
          }}
        >
          <SelectedLanguagePrefix>Language:</SelectedLanguagePrefix>
          <strong>{language}</strong>
        </Button>
      </ButtonGroup>
    </SelectedLanguageRoot>
  ) : (
    <></>
  )
}
