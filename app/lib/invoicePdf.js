const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function buildInvoicePdf(invoice, logoFilePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (logoFilePath && fs.existsSync(logoFilePath)) {
      try {
        doc.image(logoFilePath, 50, 40, { width: 140 });
      } catch {
        // Continue without logo if image decode fails
      }
    }

    doc
      .fontSize(20)
      .fillColor("#0f3f8c")
      .text(invoice.companyName, 50, 130, { align: "left" });

    doc
      .fontSize(10)
      .fillColor("#5a6570")
      .text("Cloud Engineering • Software • Consulting", 50, 155);

    doc
      .fontSize(12)
      .fillColor("#101820")
      .text(`Invoice ${invoice.invoiceNumber}`, 350, 130, { align: "right" })
      .text(`Issued ${new Date(invoice.issuedAt).toLocaleString()}`, 350, 148, { align: "right" });

    doc.moveDown(2);
    doc.fontSize(12).fillColor("#101820").text("Bill to", 50, 190);
    doc
      .fontSize(11)
      .fillColor("#333")
      .text(invoice.customer.name, 50, 208)
      .text(invoice.customer.email || "—", 50, 224);

    const tableTop = 270;
    doc.fontSize(11).fillColor("#0f3f8c");
    doc.text("Item", 50, tableTop);
    doc.text("Qty", 280, tableTop, { width: 50, align: "right" });
    doc.text("Unit", 340, tableTop, { width: 80, align: "right" });
    doc.text("Amount", 430, tableTop, { width: 100, align: "right" });
    doc
      .moveTo(50, tableTop + 16)
      .lineTo(545, tableTop + 16)
      .strokeColor("#d5dde7")
      .stroke();

    let y = tableTop + 28;
    doc.fillColor("#101820");
    for (const item of invoice.lineItems) {
      doc.text(item.name, 50, y, { width: 220 });
      doc.text(String(item.qty), 280, y, { width: 50, align: "right" });
      doc.text(money(item.unitPrice), 340, y, { width: 80, align: "right" });
      doc.text(money(item.lineTotal), 430, y, { width: 100, align: "right" });
      y += 22;
    }

    y += 12;
    doc.moveTo(320, y).lineTo(545, y).strokeColor("#d5dde7").stroke();
    y += 14;
    doc.fillColor("#5a6570").text("Subtotal", 340, y, { width: 80, align: "right" });
    doc.fillColor("#101820").text(money(invoice.subtotal), 430, y, { width: 100, align: "right" });
    y += 18;
    doc
      .fillColor("#5a6570")
      .text(`Tax (${Math.round(invoice.taxRate * 100)}%)`, 340, y, { width: 80, align: "right" });
    doc.fillColor("#101820").text(money(invoice.tax), 430, y, { width: 100, align: "right" });
    y += 22;
    doc.fontSize(13).fillColor("#0f3f8c").text("Total due", 340, y, { width: 80, align: "right" });
    doc.fontSize(13).fillColor("#0f3f8c").text(money(invoice.total), 430, y, { width: 100, align: "right" });

    doc
      .fontSize(9)
      .fillColor("#5a6570")
      .text("Thank you for shopping with ExcelCloud.", 50, 720, { align: "center", width: 495 });

    doc.end();
  });
}

function defaultLogoPath() {
  return path.join(__dirname, "..", "public", "assets", "logo.jpg");
}

module.exports = { buildInvoicePdf, defaultLogoPath };
