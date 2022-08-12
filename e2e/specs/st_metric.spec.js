describe("st.metric", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  describe("Test first metric", () => {
    it("displays the correct label text", () => {
      cy.getIndexed("[data-testid='stMetricLabel']", 0).should(
        "have.text",
        "User growth"
      );
    });

    it("displays the correct value text", () => {
      cy.getIndexed("[data-testid='stMetricValue']", 0).should(
        "have.text",
        " 123 "
      );
    });

    it("displays the correct delta text", () => {
      cy.getIndexed("[data-testid='stMetricDelta']", 0).should(
        "have.text",
        " 123 "
      );
    });
  });

  describe("Test second metric", () => {
    it("displays the correct label text", () => {
      cy.getIndexed("[data-testid='stMetricLabel']", 1).should(
        "have.text",
        "S&P 500"
      );
    });

    it("displays the correct value text", () => {
      cy.getIndexed("[data-testid='stMetricValue']", 1).should(
        "have.text",
        " -4.56 "
      );
    });

    it("displays the correct delta text", () => {
      cy.getIndexed("[data-testid='stMetricDelta']", 1).should(
        "have.text",
        " -50 "
      );
    });
  });

  describe("Test third metric", () => {
    it("displays the correct metric label text", () => {
      cy.getIndexed("[data-testid='stMetricLabel']", 2).should(
        "have.text",
        "Apples I've eaten"
      );
    });

    it("displays the correct metric value text", () => {
      cy.getIndexed("[data-testid='stMetricValue']", 2).should(
        "have.text",
        " 23k "
      );
    });

    it("displays the correct metric delta text", () => {
      cy.getIndexed("[data-testid='stMetricDelta']", 2).should(
        "have.text",
        " -20 "
      );
    });
  });

  describe("Test the dark and light theme for green up arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.getIndexed(
        '[data-testid="metric-container"]',
        0
      ).matchThemedSnapshots("metric-container-green");
    });
  });

  describe("Test the dark and light theme for red down arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.getIndexed(
        '[data-testid="metric-container"]',
        1
      ).matchThemedSnapshots("metric-container-red");
    });
  });

  describe("Test the dark and light theme for gray down arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.getIndexed(
        '[data-testid="metric-container"]',
        2
      ).matchThemedSnapshots("metric-container-gray");
    });
  });
});
