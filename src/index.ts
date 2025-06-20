import { WhoblockwhoBot } from "./bot";
import { HealthCheckServer } from "./health-check";

async function main(): Promise<void> {
  console.log("🤖 Whoblockwho - Bluesky Post Info Bot");
  console.log("=====================================");

  const bot = new WhoblockwhoBot();
  const healthServer = new HealthCheckServer(
    parseInt(process.env.PORT || "3000")
  );

  try {
    // Start health check server for Railway monitoring
    healthServer.start();

    // Start the bot
    await bot.start();
  } catch (error) {
    console.error("Fatal error:", error);
    healthServer.stop();
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
