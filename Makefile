.PHONY: serve-webhook

serve-webhook:
	supabase functions serve webhook --no-verify-jwt
