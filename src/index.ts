import { WhoblockwhoBot } from "./bot";

async function main(): Promise<void> {
  console.log("🤖 Whoblockwho - Bluesky Blocked Post Info Bot");
  console.log("============================================");

  const bot = new WhoblockwhoBot();

  try {
    await bot.start();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the bot
main();
