/**
 * @file Option component that replaces the default option to add font formatting.
 *
 * @module {Option}
 */
import React, { useEffect } from 'react'
import { components } from 'react-select'
import type { OptionProps as ReactSelectOptionProps } from "react-select"

import { addFontStylesheet, fontFaceUrlBuilder, removeFontStylesheet } from './utils/GoogleFontUtils'

import type { FontOptionProps } from './types/FontTypes'

// This extends the OptionProps from react-select
export interface OptionProps extends ReactSelectOptionProps<FontOptionProps, boolean> {
  data: FontOptionProps
}

/**
 * Option component that replaces the default option to add font formatting.
 *
 * @param {OptionProps} props - The props for the Option component.
 * @returns {React.ReactElement} The Option component.
 */
const Option: React.FC<OptionProps> = React.memo(({ children, ...props }) => {
  const data = props?.data || { family: '', variants: [] };

  useEffect(() => {
    // Build font URLs and add them to the document head
    const fontUrls = fontFaceUrlBuilder({
      families: [{
        family: data.family,
        variants: data.variants,
      }],
    })

    // Append each font stylesheet to the document head
    fontUrls.forEach(url => addFontStylesheet(url))

    // Return a cleanup function to remove the added stylesheets
    return () => {
      fontUrls.forEach(url => removeFontStylesheet(url));
    };
  }, [data.family, data.variants])

  return (
    <components.Option {...props}>
      <span style={{ fontFamily: data.family }}>
        {children}
      </span>
    </components.Option>
  )
})

export default Option
