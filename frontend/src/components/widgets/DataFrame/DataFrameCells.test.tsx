import { extractCssProperty } from "./DataFrameCells"

test("extractCssProperty should extract the correct property value", () => {
  const cssStyle1 = `
  #T_f116e_row10_col0, #T_f116e_row10_col1, #T_f116e_row10_col3 { color: red }
  #T_f116e_row0_col1, #T_f116e_row1_col0 { color: white; background-color: pink }
  #T_f116e_row0_col2 { color: red; opacity: 20% }
  #T_f116e_row2_col2, #T_f116e_row5_col1 { opacity: 20% }
  #T_f116e_row3_col3, #T_f116e_row12_col1 { color: white; background-color: darkblue; color: white; background-color: pink }
  #T_f116e_row11_col10, #T_f116e_row11_col10 {  background-color: darkblue }`

  // All color-value formats
  const cssStyle2 = `
  #T_7e5cc_row6_col0 { background-color: #f8fcc9; color: #000000 }
  #T_7e5cc_row7_col1 { background-color: #1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0 { background-color: #289cc1; color: #f1f1f1 }
  #T_7e5cc_row8_col1 { background-color: #2165ab; color: #f1f1f1 }
  #T_7e5cc_row9_col0 { background-color: #f0f9b8; color: #000000 }
  #T_f116e_row12_col14 { background-color: blue }
  #T_f116e_row13_col14 { background-color: #f1f1f1 }
  #T_f116e_row14_col1 { background-color: rgba(72 122 180 / .2); }
  #T_f116e_row15_col1 { background-color: rgba(255, 0, 12, .2)}
  #T_f116e_row16_col14 { background-color: hsla(240, 100%, 90%) }
  #T_f116e_row17_col1 { background-color: hsl(255, 0, 12)}`

  // Badly Formatted
  const cssStyle3 = `
  #T_f116e_row10_col0,#T_7e5cc_row6_col0   {   background-color: #f8fcc9;     color: #000000 }
  #T_7e5cc_row7_col1{ background-color:#1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0{background-color: #289cc1;color: #f1f1f1}
  #T_f116e_row18_col1, #T_f116e_row18_col14 { background-color: hsla(240, 100%,    90%) }
  #T_f116e_row19_col1, #T_f116e_row19_col14 { background-color: hsl(240, 100%,90%) }`

  expect(extractCssProperty("#T_f116e_row10_col1", "color", cssStyle1)).toBe(
    "red"
  )
  expect(
    extractCssProperty("#T_f116e_row12_col1", "background-color", cssStyle1)
  ).toBe("pink")
  expect(extractCssProperty("#T_f116e_row5_col1", "color", cssStyle1)).toBe(
    undefined
  )
  expect(extractCssProperty("foo", "color", cssStyle1)).toBe(undefined)
  expect(extractCssProperty("#T_f116e_row0_col2", "color", cssStyle1)).toBe(
    "red"
  )
  expect(
    extractCssProperty("#T_f116e_row11_col10", "background-color", cssStyle1)
  ).toBe("darkblue")
  // Should not extract if it only partly matches:
  expect(
    extractCssProperty("#T_f116e_row11_col1", "background-color", cssStyle1)
  ).toBe(undefined)

  expect(
    extractCssProperty("#T_7e5cc_row6_col0", "background-color", cssStyle2)
  ).toBe("#f8fcc9")
  expect(extractCssProperty("#T_7e5cc_row9_col0", "color", cssStyle2)).toBe(
    "#000000"
  )
  expect(
    extractCssProperty("#T_f116e_row12_col14", "background-color", cssStyle2)
  ).toBe("blue")
  expect(
    extractCssProperty("#T_f116e_row13_col14", "background-color", cssStyle2)
  ).toBe("#f1f1f1")
  expect(
    extractCssProperty("#T_f116e_row14_col1", "background-color", cssStyle2)
  ).toBe("rgba(72 122 180 / .2)")
  expect(
    extractCssProperty("#T_f116e_row15_col1", "background-color", cssStyle2)
  ).toBe("rgba(255, 0, 12, .2)")
  expect(
    extractCssProperty("#T_f116e_row16_col14", "background-color", cssStyle2)
  ).toBe("hsla(240, 100%, 90%)")
  expect(
    extractCssProperty("#T_f116e_row17_col1", "background-color", cssStyle2)
  ).toBe("hsl(255, 0, 12)")

  expect(
    extractCssProperty("#T_f116e_row10_col0", "background-color", cssStyle3)
  ).toBe("#f8fcc9")
  expect(
    extractCssProperty("#T_7e5cc_row8_col0", "background-color", cssStyle3)
  ).toBe("#289cc1")
  expect(
    extractCssProperty("#T_f116e_row18_col14", "background-color", cssStyle3)
  ).toBe("hsla(240, 100%,    90%)")
  expect(
    extractCssProperty("#T_f116e_row19_col14", "background-color", cssStyle3)
  ).toBe("hsl(240, 100%,90%)")
  expect(extractCssProperty("#T_7e5cc_row8_col0", "color", cssStyle3)).toBe(
    "#f1f1f1"
  )
})
