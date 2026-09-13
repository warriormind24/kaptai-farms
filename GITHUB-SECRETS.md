# Admin credentials

The upload API reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from server environment variables. Never commit the real password or a `.env` file.

## GitHub Actions

1. Open the repository on GitHub.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add repository secrets named `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Configure the hosting service or deployment workflow to expose those secrets to the running Node server.

GitHub Pages cannot run the content API or provide runtime secrets. Deploy the API with the site on Vercel, then add these Vercel environment variables:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
SESSION_SECRET
GITHUB_TOKEN
GITHUB_OWNER=warriormind24
GITHUB_REPO=kaptai-farms
GITHUB_BRANCH=main
```

`GITHUB_TOKEN` should be a fine-grained token limited to this repository with **Contents: Read and write** permission. The Vercel API stores pending submissions and approved content in the repository through the GitHub Contents API.

For local development, copy `.env.example` to `.env` and load the values in your shell before starting the server. The `.env` file is ignored by Git.
