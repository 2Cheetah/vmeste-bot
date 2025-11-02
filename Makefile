.PHONY: start-supabase serve-webhook test-webhook
.DEFAULT_GOAL=serve-webhook

start-supabase:
	supabase start

serve-webhook: start-supabase
	supabase functions serve webhook --no-verify-jwt --env-file=supabase/functions/.env

test-webhook:
	deno test --allow-all --env-file=./supabase/functions/tests/.env.local ./supabase/functions/tests/webhook-test.ts
