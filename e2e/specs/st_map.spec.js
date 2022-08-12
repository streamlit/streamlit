describe("st.map", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays 3 maps", () => {
    cy.get(".element-container .stDeckGlJsonChart").should("have.length", 3)
  });
  
  it("displays 3 zoom buttons", () => {
    cy.get(".element-container .zoomButton").should("have.length", 3)
  })

  it("displays the correct snapshot", () => {
    cy.get(".mapboxgl-canvas")
    cy.get(".element-container", { waitForAnimations: true }).last().matchThemedSnapshots("stDeckGlJsonChart")
  })
});
