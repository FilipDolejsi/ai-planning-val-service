# PDDL and Plan VALidation and eVALuation Service

## Getting started

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node http-json-server.js
```

Configure the PDDL extension for VS Code to use this service to validate PDDL using your `settings.json`:

```json
{
    "pddlParser.executableOrService": "http://localhost:8085/parse"
}
```

Start editing a `.pddl` file and the parsing erros should start appearing in the Problems pane.
