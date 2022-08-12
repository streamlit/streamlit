describe("st.color_picker", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("shows the widget correctly", () => {
    cy.get("[data-testid='stColorPicker']").should("have.length", 5);

    cy.get("[data-testid='stColorPicker']").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("colorpicker" + idx);
    });
  });
});
