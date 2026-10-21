# Installing and using Pro-Papa

Repository: https://github.com/Papa3445/Pro-Papa

Clone this repository and use Node.js 20 or newer:

```bash
git clone https://github.com/Papa3445/Pro-Papa.git
cd Pro-Papa
npm run check
npm run next
```

Use the CLI from another directory to initialize and manage a separate project:

```bash
node /path/to/Pro-Papa/bin/pro-papa.mjs init --root /path/to/new-project --name "My project" --guide true
```

See README.md for the complete task lifecycle. This framework does not require an API key, run its own language model, or automatically do background work; a host with authorized tools is required for actual execution.
