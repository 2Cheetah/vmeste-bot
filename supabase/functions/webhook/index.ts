import "edge-runtime";
import { createClient } from "supabase";
import { Bot, webhookCallback } from "grammy";
import { Database } from "../../database.types.ts";
import { BotCommands, getConfig, TicketService } from "./services.ts";

function setupBot(config: ReturnType<typeof getConfig>): Bot {
  const supabase = createClient<Database>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );

  const ticketService = new TicketService(supabase);
  const commands = new BotCommands(ticketService);

  const bot = new Bot(config.telegramBotToken);

  bot.command("start", commands.start);
  bot.command("whoami", commands.whoami);
  bot.command("ping", commands.ping);
  bot.command("buy", commands.buy);
  bot.command("lessonsLeft", commands.lessonsLeft);

  return bot;
}

function createHandler(bot: Bot, secret: string) {
  const handleUpdate = webhookCallback(bot, "std/http");

  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const url = new URL(req.url);
      if (url.searchParams.get("secret") !== secret) {
        return new Response("Unauthorized", { status: 401 });
      }

      return await handleUpdate(req);
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
}

const config = getConfig();
const bot = setupBot(config);
const handler = createHandler(bot, config.functionSecret);

Deno.serve(handler);
