/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC, useContext } from "react"

import { DatepickerProps, Datepicker as UIDatePicker } from "baseui/datepicker"

import { Skeleton } from "@streamlit/lib/src/components/elements/Skeleton"
import { Skeleton as SkeletonProto } from "@streamlit/lib/src/proto"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"

import { useDateFnsLocale } from "./useDateFnsLocale"

export type UIDatePickerWithLocaleProps = Omit<DatepickerProps, "locale">

export const UIDatePickerWithLocale: FC<
  UIDatePickerWithLocaleProps
> = props => {
  const { locale } = useContext(LibContext)
  const loadedLocale = useDateFnsLocale(locale)

  if (!loadedLocale) {
    return (
      <Skeleton
        element={SkeletonProto.create({
          style: SkeletonProto.SkeletonStyle.ELEMENT,
        })}
      />
    )
  }

  const usableLocale =
    // If the locale could not be loaded, match the previous behavior by
    // rendering the date picker without a defined locale.
    loadedLocale instanceof Error ? undefined : loadedLocale

  return <UIDatePicker {...props} locale={usableLocale} />
}
