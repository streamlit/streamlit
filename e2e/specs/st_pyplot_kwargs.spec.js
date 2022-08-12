describe("st.pyplot with kwargs", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Wait for the site to be fully loaded
    cy.contains("Done!", { timeout: 100000 }).should($els => {
      expect($els).to.have.length.of.at.least(1);
    });

    cy.prepForElementSnapshots();
  });
});
