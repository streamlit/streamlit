import { Theme as StreamlitTheme } from "src/theme"

// Outside imports make declarations not ambient, so we separate out from
// the ambient declarations.d.ts
//
// This declaration allows us to extend our type declarations for emotion's
// theme (an empty object) to be our type
declare module "@emotion/react" {
  export interface Theme extends StreamlitTheme {}
}
