import "edge-runtime";
import { createClient } from "supabase";
import { Bot, Context, webhookCallback } from "grammy";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing mandatory envs");
}

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
);

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN")!);

bot.command(
  "start",
  (ctx: Context) => ctx.reply(`Welcome! The bot is up and running.`),
);

bot.command("whoami", async (ctx: Context) => {
  const username = ctx.message?.from.username;
  await ctx.reply(
    `Your username is ${username}`,
  );
});

bot.command(
  "ping",
  (ctx: Context) => ctx.reply(`Pong! ${new Date()} ${Date.now()}`),
);

bot.command("buy", buyHandler);

async function buyHandler(ctx: Context) {
  // Check for existing season tickets
  const userId = ctx.message?.from.id;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      // Register the user
      ctx.reply("UserId not found in DB");
    }
  } catch (err) {
    console.error(err);
    ctx.reply(
      `Error occured while processing your request.`,
    );
  }

  // Create a record in DB
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
