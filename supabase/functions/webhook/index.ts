import "edge-runtime";
import { createClient, SupabaseClient } from "supabase";
import { Bot, Context, webhookCallback } from "grammy";
import { User } from "grammy_types";
import { Database } from "../../database.types.ts";

// Types
type Tables = Database["public"]["Tables"];
type UserRow = Tables["users"]["Row"];
type TicketRow = Tables["tickets"]["Row"];

interface Config {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  telegramBotToken: string;
  functionSecret: string;
}

// Configuration
function getConfig(): Config {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const functionSecret = Deno.env.get("FUNCTION_SECRET");

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey ||
    !telegramBotToken ||
    !functionSecret
  ) {
    throw new Error(
      "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, FUNCTION_SECRET",
    );
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    telegramBotToken,
    functionSecret,
  };
}

// Database Service
class TicketService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async userExists(userId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }

    return data !== null;
  }

  async createUser(user: User): Promise<void> {
    const { error } = await this.supabase
      .from("users")
      .insert({
        id: user.id,
        username: user.username ?? "",
      });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getLatestTicket(userId: number): Promise<TicketRow | null> {
    const { data, error } = await this.supabase
      .from("tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch ticket: ${error.message}`);
    }

    return data;
  }

  async createTicket(userId: number, lessonsTotal = 4): Promise<void> {
    const { error } = await this.supabase
      .from("tickets")
      .insert({
        user_id: userId,
        lessons_total: lessonsTotal,
      });

    if (error) {
      throw new Error(`Failed to create ticket: ${error.message}`);
    }
  }

  calculateLessonsLeft(ticket: TicketRow): number {
    return ticket.lessons_total - ticket.lessons_used;
  }
}

// Command Handlers
class BotCommands {
  constructor(private ticketService: TicketService) {}

  async ensureUserRegistered(ctx: Context): Promise<User> {
    const user = ctx.message?.from;
    if (!user) {
      throw new Error("No user information in message");
    }

    const exists = await this.ticketService.userExists(user.id);
    if (!exists) {
      await ctx.reply("User not found in DB. Adding...");
      await this.ticketService.createUser(user);
    }

    return user;
  }

  start = (ctx: Context) => {
    return ctx.reply("Welcome! The bot is up and running.");
  };

  whoami = (ctx: Context) => {
    const username = ctx.message?.from.username ?? "unknown";
    return ctx.reply(`Your username is ${username}`);
  };

  ping = (ctx: Context) => {
    const now = new Date();
    return ctx.reply(`Pong! ${now.toISOString()} (${now.getTime()})`);
  };

  buy = async (ctx: Context) => {
    try {
      const user = await this.ensureUserRegistered(ctx);

      const ticket = await this.ticketService.getLatestTicket(user.id);
      if (ticket) {
        const lessonsLeft = this.ticketService.calculateLessonsLeft(ticket);
        if (lessonsLeft > 0) {
          return ctx.reply(
            `You still have a valid season ticket with ${lessonsLeft} lesson${
              lessonsLeft === 1 ? "" : "s"
            } left.`,
          );
        }
      }

      await this.ticketService.createTicket(user.id);
      return ctx.reply("You successfully bought a season ticket!");
    } catch (error) {
      console.error("Error in buy command:", error);
      return ctx.reply(
        "An error occurred while processing your request. Please try again later.",
      );
    }
  };

  lessonsLeft = async (ctx: Context) => {
    try {
      const user = await this.ensureUserRegistered(ctx);

      const ticket = await this.ticketService.getLatestTicket(user.id);
      if (!ticket) {
        return ctx.reply(
          "You don't have any season ticket. Why not buy one now with /buy?",
        );
      }

      const lessonsLeft = this.ticketService.calculateLessonsLeft(ticket);
      if (lessonsLeft === 0) {
        return ctx.reply(
          "Your last season ticket has been fully claimed. Why not buy one now with /buy?",
        );
      }

      return ctx.reply(
        `You still have a valid season ticket with ${lessonsLeft} lesson${
          lessonsLeft === 1 ? "" : "s"
        } left.`,
      );
    } catch (error) {
      console.error("Error in lessonsLeft command:", error);
      return ctx.reply(
        "Something went wrong. Please try again later.",
      );
    }
  };
}

// Bot Setup
function setupBot(config: Config): Bot {
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

// HTTP Handler
function createHandler(bot: Bot, secret: string) {
  const handleUpdate = webhookCallback(bot, "std/http");

  return async (req: Request): Promise<Response> => {
    try {
      // Method check
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      // Secret validation
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

// Main
const config = getConfig();
const bot = setupBot(config);
const handler = createHandler(bot, config.functionSecret);

Deno.serve(handler);
