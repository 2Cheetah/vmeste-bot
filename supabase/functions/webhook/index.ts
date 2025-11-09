import "edge-runtime";
import { createClient } from "supabase";
import { Bot, Context, webhookCallback } from "grammy";
import { User } from "grammy_types";
import { Database } from "../../database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing mandatory envs");
}

const supabase = createClient<Database>(
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
  try {
    const u: User = ctx.message?.from!;

    if (!await isUserExist(u.id)) {
      ctx.reply("User not found in DB. Adding...");
      await registerUser(u);
    }

    const t = await getSeasonTicket(u);
    if (t) {
      const lessonsLeft = t.lessons_total - t.lessons_used;
      return ctx.reply(
        `You still have a valid season ticket with ${lessonsLeft} lessons left.`,
      );
    }

    await buyTicket(u);
  } catch (err) {
    console.error(err);
    ctx.reply(
      `Error occured while processing your request.`,
    );
  }

  // Create a record in DB
  return await ctx.reply("You successfully bought a season ticket!");
}

async function isUserExist(userId: number) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId);

  if (error) {
    throw error;
  }

  if (!data[0]) {
    return false;
  }

  return true;
}

async function registerUser(u: User) {
  const { error } = await supabase
    .from("users")
    .insert({
      id: u.id,
      username: u.username || "",
    });

  if (error) {
    console.error("couldn't insert the user to the DB");
    throw error;
  }
}

async function getSeasonTicket(u: User) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("userId", u.id);

  if (error) {
    throw error;
  }

  if (data[0]) {
    return data[0];
  }
}

async function buyTicket(u: User) {
  const { error } = await supabase
    .from("tickets")
    .insert({
      user_id: u.id,
      lessons_total: 4,
    });

  if (error) {
    throw error;
  }
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
