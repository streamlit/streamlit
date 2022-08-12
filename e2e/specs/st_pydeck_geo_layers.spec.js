describe("st.pydeck_chart geo layers", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays H3 hexagon layer", () => {
    // NB: #view-default-view needs to be invisible
    // to be able to capture the layer.
    cy.get("#view-default-view").invoke("css", "display", "none");

    cy.get(".element-container .stDeckGlJsonChart")
      .find("#deckgl-overlay")
      .matchThemedSnapshots("h3-hexagon-layer");
  });

  it("checks if layers have tooltip", () => {
    cy.get(".element-container .stDeckGlJsonChart")
      .find(".deck-tooltip")
      .should("exist");
  });
});
