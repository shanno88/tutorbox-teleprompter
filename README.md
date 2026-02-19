# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment Variables

This project uses `.env` files for secrets. For security reasons, `.env` is ignored by Git.

### Setup

1. Copy the example file to `.env`:
   ```bash
   cp .env.paddle.example .env
   ```

2. Fill in your real Paddle credentials:
   - **Frontend (Vite)**: `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENVIRONMENT`
   - **Backend (Express)**: `PADDLE_SELLER_ID`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`
   - **Price IDs**: `PADDLE_PRICE_ID_MONTHLY`, `PADDLE_PRICE_ID_YEARLY`

### Important

- **Never commit `.env`**. Only commit `.env.paddle.example` (placeholders only).
- Frontend variables must start with `VITE_` (Vite requirement).
- Frontend reads via `import.meta.env.*`, backend reads via `process.env.*`.

### Getting Paddle Credentials

1. Log in to [Paddle Dashboard](https://vendors.paddle.com/)
2. **Seller ID**: Dashboard右上角 or Settings > Company
3. **Client Token**: Developer Tools > Client-side tokens > Generate token
4. **API Key**: Developer Tools > Authentication > Generate API key
5. **Price ID**: Catalog > Select product > Prices tab > Copy Price ID (starts with `pri_`)
6. **Webhook Secret**: Developer Tools > Notifications > Create webhook

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
