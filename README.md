# Deploy

- Run `supabase functions deploy --no-verify-jwt telegram-bot`
- Get your Telegram token from https://t.me/BotFather
- Run supabase secrets set
  `TELEGRAM_BOT_TOKEN=your_token FUNCTION_SECRET=random_secret`
- Set your bot's webhook url to
  `https://<PROJECT_REFERENCE>.functions.supabase.co/telegram-bot` (Replacing
  <...> with respective values). In order to do that, run this url (in your
  browser, for example):
  `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<PROJECT_REFERENCE>.supabase.co/functions/v1/telegram-bot?secret=<FUNCTION_SECRET>`

That's it, go ahead and chat with your bot 🤖💬
