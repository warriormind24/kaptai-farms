# Admin credentials

The upload API reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from server environment variables. Never commit the real password or a `.env` file.

## GitHub Actions

1. Open the repository on GitHub.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add repository secrets named `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Configure the hosting service or deployment workflow to expose those secrets to the running Node server.

GitHub Pages cannot run `server.js` or provide runtime secrets. The API must run on a backend host, with the two secrets configured as environment variables there.

For local development, copy `.env.example` to `.env` and load the values in your shell before starting the server. The `.env` file is ignored by Git.
