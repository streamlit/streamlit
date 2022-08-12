describe("st.pydeck_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays 2 maps", () => {
    const els = cy.get(".element-container .stDeckGlJsonChart");

    els.should("have.length", 2);

    els.find("canvas").should("have.css", "height", "500px");
  });
});
