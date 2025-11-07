import "edge-runtime";
import { Bot, Context, webhookCallback } from "grammy";

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN")!);

bot.command("start", (ctx) => ctx.reply(`Welcome! The bot is up and running.`));

bot.command("whoami", async (ctx) => {
  const username = ctx.message?.from.username;
  await ctx.reply(
    `Your username is ${username}`,
  );
});

bot.command("ping", (ctx) => ctx.reply(`Pong! ${new Date()} ${Date.now()}`));

bot.command("buy", buyHandler);

async function buyHandler(ctx: Context) {
  return await ctx.reply("You successfully bought a season ticket!");
}

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("method not allowed", {
        status: 405,
      });
    }

    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response("not allowed", {
        status: 405,
      });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500,
    });
  }
});
