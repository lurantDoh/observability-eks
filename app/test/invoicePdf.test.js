const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildInvoice, calculateTotals } = require("../lib/cart");
const { buildInvoicePdf, defaultLogoPath } = require("../lib/invoicePdf");

describe("buildInvoicePdf", () => {
  it("creates a PDF buffer with invoice content", async () => {
    const totals = calculateTotals([{ id: "sku-tee", qty: 1 }]);
    const invoice = buildInvoice({
      companyName: "ExcelCloud Market",
      customer: { name: "Ada", email: "ada@example.com" },
      totals,
      logoPath: "/assets/logo.jpg",
    });
    const pdf = await buildInvoicePdf(invoice, defaultLogoPath());
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  });
});
