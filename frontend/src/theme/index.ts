import main from "./mainTheme"

export type Theme = typeof main
export const mainTheme: Theme = main
// TODO Update when components with sidebar differences use styled components
export const sidebarTheme: Theme = main
