# Supabase Auth e-mail templates

These files are version-controlled sources for templates that are applied manually in the hosted Supabase Dashboard. They are not deployed by database migrations or Edge Function deployment.

## Confirm sign up

- Dashboard: **Authentication → Email Templates → Confirm sign up**
- Subject: `Potvrď svoj e-mail | Východ Brothers Club`
- Body: paste the complete contents of `confirmation.html`
- CTA variable: `{{ .ConfirmationURL }}`

`ConfirmationURL` is intentionally used without rebuilding the token URL. Supabase therefore keeps the confirmation token, its one-time verification behavior, and the `emailRedirectTo` supplied by the application.

The application currently supplies:

`/auth/callback?next=/clenstvo`

for both initial registration and resend confirmation. Make sure the production callback URL is present in **Authentication → URL Configuration → Redirect URLs** before testing.

The hosted Auth SMTP sender name and address are configured separately in **Project Settings → Authentication → SMTP Settings**. Confirm there that the sender is `Východ Brothers <noreply@vychodbrothersclub.sk>`.

If the SMTP provider offers click tracking, keep it disabled for Auth messages so it does not rewrite the one-time confirmation URL.
