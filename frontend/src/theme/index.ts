import main from "./mainTheme"
import sidebar from "./sidebarTheme"

export type Theme = typeof main
export const mainTheme: Theme = main
export const sidebarTheme: Theme = sidebar
