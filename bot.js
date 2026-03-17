const TelegramBot = require("node-telegram-bot-api");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// 🔴 Replace with your bot token
const TOKEN = "YOUR_BOT_TOKEN_HERE";

const bot = new TelegramBot(TOKEN, { polling: true });

// Per-user text storage
const userData = new Map();

// A4 size in PDFKit (points)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

// Margins
const MARGIN = 40;

// Row height (3 equal rows)
const ROW_HEIGHT = (PAGE_HEIGHT - MARGIN * 2) / 3;

// Start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Send text to add into PDF.\n/done → Generate PDF\n/clear → Reset text"
  );
});

// Clear command
bot.onText(/\/clear/, (msg) => {
  userData.set(msg.chat.id, "");
  bot.sendMessage(msg.chat.id, "Text cleared.");
});

// Done command → generate PDF
bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id;
  const text = userData.get(chatId);

  if (!text || text.trim() === "") {
    bot.sendMessage(chatId, "No text available.");
    return;
  }

  const filePath = path.join(__dirname, `output_${chatId}.pdf`);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Font size = 6 pt
  doc.fontSize(6);

  let currentY = MARGIN;
  let currentRow = 0;

  // Function to add new page
  const addNewPage = () => {
    doc.addPage();
    currentY = MARGIN;
    currentRow = 0;
  };

  // Split text into words for wrapping
  const words = text.split(" ");
  let line = "";

  words.forEach((word, index) => {
    let testLine = line + word + " ";
    let width = doc.widthOfString(testLine);

    if (width > PAGE_WIDTH - MARGIN * 2) {
      // Print current line
      doc.text(line, MARGIN, currentY, {
        width: PAGE_WIDTH - MARGIN * 2
      });

      currentY += doc.currentLineHeight();

      // Check row overflow
      if (currentY > MARGIN + ROW_HEIGHT * (currentRow + 1)) {
        currentRow++;

        if (currentRow >= 3) {
          addNewPage();
        } else {
          currentY = MARGIN + ROW_HEIGHT * currentRow;
        }
      }

      line = word + " ";
    } else {
      line = testLine;
    }

    // Last word
    if (index === words.length - 1) {
      doc.text(line, MARGIN, currentY, {
        width: PAGE_WIDTH - MARGIN * 2
      });
    }
  });

  doc.end();

  stream.on("finish", () => {
    bot.sendDocument(chatId, filePath).then(() => {
      fs.unlinkSync(filePath);
      userData.set(chatId, "");
    });
  });
});

// Handle incoming text
bot.on("message", (msg) => {
  if (
    msg.text &&
    !msg.text.startsWith("/start") &&
    !msg.text.startsWith("/done") &&
    !msg.text.startsWith("/clear")
  ) {
    const chatId = msg.chat.id;

    const existingText = userData.get(chatId) || "";
    userData.set(chatId, existingText + msg.text + "\n");
  }
});
