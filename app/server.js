const express = require("express");
const path = require("path");
const client = require("prom-client");
const { PRODUCTS, calculateTotals, buildInvoice } = require("./lib/cart");
const { buildInvoicePdf, defaultLogoPath } = require("./lib/invoicePdf");
const { sendInvoiceEmail, isEmailConfigured } = require("./lib/mailer");
const { saveInvoice, getInvoice } = require("./lib/store");

const app = express();
const PORT = process.env.PORT || 3000;
const COMPANY_NAME = process.env.COMPANY_NAME || "ExcelCloud Market";

const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpRequests = new client.Counter({
  name: "ecommerce_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});
const invoicesCreated = new client.Counter({
  name: "ecommerce_invoices_created_total",
  help: "Total invoices created",
  registers: [register],
});
const invoicesEmailed = new client.Counter({
  name: "ecommerce_invoices_emailed_total",
  help: "Total invoices emailed successfully",
  registers: [register],
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    httpRequests.inc({
      method: req.method,
      route,
      status: String(res.statusCode),
    });
  });
  next();
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", (_req, res) => {
  res.status(200).json({ status: "ready" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/api/products", (_req, res) => {
  res.json({
    company: COMPANY_NAME,
    products: PRODUCTS,
    emailEnabled: isEmailConfigured(),
  });
});

app.post("/api/checkout", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const customer = {
    name: String(req.body?.customerName || "Guest").trim() || "Guest",
    email: String(req.body?.customerEmail || "").trim(),
  };
  const sendEmail = req.body?.sendEmail !== false;

  if (!customer.email || !isValidEmail(customer.email)) {
    return res.status(400).json({ error: "A valid customer email is required" });
  }

  try {
    const totals = calculateTotals(items);
    const invoice = buildInvoice({
      companyName: COMPANY_NAME,
      customer,
      totals,
      logoPath: "/assets/logo.jpg",
    });

    const pdfBuffer = await buildInvoicePdf(invoice, defaultLogoPath());
    saveInvoice(invoice, pdfBuffer);
    invoicesCreated.inc();

    let emailResult = { sent: false, skipped: true, reason: "Email send disabled by request" };
    if (sendEmail) {
      try {
        emailResult = await sendInvoiceEmail({ invoice, pdfBuffer });
        if (emailResult.sent) invoicesEmailed.inc();
      } catch (err) {
        emailResult = {
          sent: false,
          error: err.message || "Failed to send invoice email",
        };
      }
    }

    res.status(201).json({
      ...invoice,
      pdfUrl: `/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}/pdf`,
      email: emailResult,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Invalid cart" });
  }
});

app.get("/api/invoices/:invoiceNumber/pdf", (req, res) => {
  const record = getInvoice(req.params.invoiceNumber);
  if (!record) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const filename = `${record.invoice.invoiceNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", record.pdfBuffer.length);
  return res.status(200).send(record.pdfBuffer);
});

app.post("/api/invoices/:invoiceNumber/email", async (req, res) => {
  const record = getInvoice(req.params.invoiceNumber);
  if (!record) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const overrideEmail = String(req.body?.email || "").trim();
  if (overrideEmail) {
    if (!isValidEmail(overrideEmail)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    record.invoice.customer.email = overrideEmail;
  }

  try {
    const emailResult = await sendInvoiceEmail({
      invoice: record.invoice,
      pdfBuffer: record.pdfBuffer,
    });
    if (emailResult.sent) invoicesEmailed.inc();
    res.status(emailResult.sent ? 200 : 502).json({ email: emailResult });
  } catch (err) {
    res.status(502).json({ error: err.message || "Failed to send email" });
  }
});

app.listen(PORT, () => {
  console.log(`Ecommerce app listening on :${PORT}`);
  console.log(`Email configured: ${isEmailConfigured()}`);
});
