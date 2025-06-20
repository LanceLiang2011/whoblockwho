#!/usr/bin/env node

/**
 * Step-by-step setup guide for Whoblockwho Bot
 */

import { ConfigManager } from "./src/config";
import { BlueskyAuthenticator } from "./src/auth";

console.log("🤖 Whoblockwho Bot Setup Guide");
console.log("==============================\n");

async function setupGuide() {
  try {
    // Step 1: Check configuration
    console.log("📋 Step 1: Checking configuration...");
    const config = ConfigManager.getInstance().getConfig();

    console.log(`   Handle: ${config.bskyHandle}`);
    console.log(
      `   App Password: ${
        config.bskyAppPassword === "your_app_password_here"
          ? "❌ NOT SET"
          : "✅ SET"
      }`
    );

    if (config.bskyAppPassword === "your_app_password_here") {
      console.log("\n🔧 Setup Required:");
      console.log("   1. Go to Bluesky app/website");
      console.log("   2. Navigate to Settings → App Passwords");
      console.log("   3. Create a new App Password for this bot");
      console.log("   4. Update BSKY_APP_PASSWORD in your .env file");
      console.log("   5. Run this setup again to test\n");
      return;
    }

    // Step 2: Test authentication
    console.log("\n🔐 Step 2: Testing authentication...");
    const authenticator = new BlueskyAuthenticator(config);
    await authenticator.login();
    console.log("   ✅ Authentication successful!");
    await authenticator.logout();

    // Step 3: Success!
    console.log("\n🎉 Setup Complete!");
    console.log("\n🚀 Ready to run:");
    console.log("   npm run dev");
    console.log("\n📝 How to test:");
    console.log('   1. Find a repost that shows "[Post unavailable]"');
    console.log(
      "   2. Reply to that repost mentioning @whoblockthis.bsky.social"
    );
    console.log("   3. The bot will analyze and reply with post information");
    console.log("\n💡 The bot will respond with messages like:");
    console.log(
      '   "The original post is by @alice and reposted by @bob."'
    );
    console.log(
      '   "The original post is by @alice and @bob replied to it."'
    );
    console.log(
      '   "The original post is by @alice."'
    );
  } catch (error: any) {
    console.error("\n❌ Setup failed:", error.message);

    if (error.message.includes("authentication")) {
      console.log("\n🔧 Authentication troubleshooting:");
      console.log("   - Double-check your handle is correct");
      console.log(
        "   - Make sure you created an APP PASSWORD (not your main password)"
      );
      console.log("   - Verify the app password is correctly copied to .env");
      console.log(
        "   - Try creating a new app password if this one doesn't work"
      );
    } else {
      console.log("\n🔧 General troubleshooting:");
      console.log("   - Check your internet connection");
      console.log("   - Verify Bluesky service is accessible");
      console.log("   - Ensure your .env file format is correct");
    }
  }
}

setupGuide();
