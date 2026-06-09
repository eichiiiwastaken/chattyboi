# Security

## Public Repository Checklist

- Do not commit `.env` files or real secrets. Use `.env.example` for placeholders only.
- Set a strong `AUTH_SECRET` in every deployment.
- Configure `ALLOWED_USERS` with bcrypt `passwordHash` values instead of plaintext passwords for production.
- Replace the default `POSTGRES_PASSWORD` before exposing Postgres outside a private Docker network.
- Keep uploaded files on private storage or the app's protected `/uploads/:filename` route.

## Reporting

Please open a private security advisory or contact the repository owner before disclosing a vulnerability publicly.
