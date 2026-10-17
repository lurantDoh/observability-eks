const nodemailer = require("nodemailer");

function isEmailConfigured() {
  if (process.env.EMAIL_TRANSPORT === "ses") return Boolean(process.env.EMAIL_FROM);
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

async function createTransport() {
  const transport = (process.env.EMAIL_TRANSPORT || "smtp").toLowerCase();

  if (transport === "ses") {
    const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
    const region = process.env.AWS_REGION || process.env.SES_REGION || "us-east-1";
    const sesClient = new SESv2Client({ region });

    return nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand },
    });
  }

  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

async function sendInvoiceEmail({ invoice, pdfBuffer }) {
  if (!invoice.customer?.email) {
    return { sent: false, skipped: true, reason: "No customer email provided" };
  }

  if (!isEmailConfigured()) {
    return {
      sent: false,
      skipped: true,
      reason: "Email is not configured (set EMAIL_TRANSPORT/EMAIL_FROM and SMTP_* or SES)",
    };
  }

  const from = process.env.EMAIL_FROM;
  const transport = await createTransport();
  const filename = `${invoice.invoiceNumber}.pdf`;

  const info = await transport.sendMail({
    from: `"${invoice.companyName}" <${from}>`,
    to: invoice.customer.email,
    subject: `${invoice.companyName} invoice ${invoice.invoiceNumber}`,
    text: [
      `Hi ${invoice.customer.name},`,
      "",
      `Thanks for your purchase from ${invoice.companyName}.`,
      `Invoice: ${invoice.invoiceNumber}`,
      `Total due: $${invoice.total.toFixed(2)}`,
      "",
      "Your PDF invoice is attached.",
      "",
      "— ExcelCloud",
    ].join("\n"),
    html: `
      <p>Hi ${invoice.customer.name},</p>
      <p>Thanks for your purchase from <strong>${invoice.companyName}</strong>.</p>
      <p>Invoice <strong>${invoice.invoiceNumber}</strong><br/>Total due: <strong>$${invoice.total.toFixed(2)}</strong></p>
      <p>Your PDF invoice is attached.</p>
      <p>— ExcelCloud</p>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return {
    sent: true,
    messageId: info.messageId,
    to: invoice.customer.email,
  };
}

module.exports = { sendInvoiceEmail, isEmailConfigured };
