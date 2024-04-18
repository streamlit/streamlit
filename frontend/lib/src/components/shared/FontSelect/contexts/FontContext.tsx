/**
 * @file This context provides access to font information across the application.
 */
import React, { createContext, useContext, useMemo, useState, ReactNode } from "react"

import { useFetchGoogleFonts } from "../hooks/useFetchGoogleFonts"
import type { FontOptionProps } from "../types/FontTypes"

/**
 * Defines the context type for font-related data.
 */
export interface FontContextProps {
  selectedFonts: FontOptionProps[]
  setSelectedFonts: React.Dispatch<React.SetStateAction<FontOptionProps[]>>
  fontOptions: FontOptionProps[]
  isLoading: boolean
}

/**
 * The font context for providing font-related data across the app.
 */
export const FontContext = createContext<FontContextProps>({
  selectedFonts: [],
  setSelectedFonts: () => {},
  fontOptions: [],
  isLoading: false,
})

/**
 * Provides font-related data to children components.
 *
 * @param {ReactNode} children - The child components.
 * @returns {ReactNode} The provider component.
 */
export const FontProvider = ({ children }: { children: ReactNode }) => {
  const { fontOptions, isLoading } = useFetchGoogleFonts({
    sort: "alpha",
    categories: ["all"],
  })
  const [selectedFonts, setSelectedFonts] = useState<FontOptionProps[]>([])

  const value = useMemo(() => ({
    selectedFonts,
    setSelectedFonts,
    fontOptions,
    isLoading,
  }), [selectedFonts, fontOptions, isLoading]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>
}

/**
 * A hook to consume and utilize the font context.
 *
 * @returns {FontContextType} The context for font-related data.
 */
export const useFont = () => {
  const context = useContext(FontContext)
  if (!context) {
    throw new Error("useFont must be used within a FontProvider")
  }

  return context
}
