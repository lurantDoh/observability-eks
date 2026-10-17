const nodemailer = require("nodemailer");
const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");

function isEmailConfigured() {
  if ((process.env.EMAIL_TRANSPORT || "").toLowerCase() === "ses") {
    return Boolean(process.env.EMAIL_FROM);
  }
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function buildMailContent({ invoice, pdfBuffer }) {
  const filename = `${invoice.invoiceNumber}.pdf`;
  return {
    from: `"${invoice.companyName}" <${process.env.EMAIL_FROM}>`,
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
  };
}

async function sendViaSes(mail) {
  const region = process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";
  const ses = new SESClient({ region });

  // Build a MIME message with nodemailer's stream compiler, then send with SES SendRawEmail
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const built = await transport.sendMail(mail);
  const raw = built.message;

  const result = await ses.send(
    new SendRawEmailCommand({
      RawMessage: { Data: raw },
      Source: process.env.EMAIL_FROM,
      Destinations: [mail.to],
    })
  );

  return {
    sent: true,
    messageId: result.MessageId,
    to: mail.to,
  };
}

async function sendViaSmtp(mail) {
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
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
  const info = await transport.sendMail(mail);
  return {
    sent: true,
    messageId: info.messageId,
    to: mail.to,
  };
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

  const mail = buildMailContent({ invoice, pdfBuffer });
  const transport = (process.env.EMAIL_TRANSPORT || "smtp").toLowerCase();

  if (transport === "ses") {
    return sendViaSes(mail);
  }
  return sendViaSmtp(mail);
}

module.exports = { sendInvoiceEmail, isEmailConfigured };
