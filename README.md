[![MIT License](https://img.shields.io/apm/l/atomic-design-ui.svg?)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)

# @sloikaxyz/remix-auth-siwe

A Remix Auth strategy to sign in with Ethereum

`@sloikaxyz/remix-auth-siwe` provides a [remix-siwe](https://github.com/sergiodxa/remix-auth) authentication strategy for [Sign in with Ethereum.](https://login.xyz)

# Strategy Name

siwe

## Supported runtimes

| Runtime    | Has Support |
| ---------- | ----------- |
| Node.js    | ✅          |
| Cloudflare | ✅          |

## How to use

Set up the authenticator:

```typescript
// app/services/auth.server.ts
import { Authenticator } from "remix-auth";
import { SiweStrategy } from "remix-auth-siwe";

import { sessionStorage } from "~/services/session.server";
import type { User } from "~/services/session.server";

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export let authenticator = new Authenticator<User>(sessionStorage, {
  sessionKey: "sessionKey", // keep in sync
  sessionErrorKey: "sessionErrorKey", // keep in sync
});

authenticator.use(
  new SiweStrategy({ domain: "localhost:3000" }, async ({ message }) => {
    return await Promise.resolve({ address: message.address });
  }),
  "siwe"
);
```

Create an action to authenticate user:

```typescript
export const action: ActionFunction = async ({ request, context }) => {
  await authenticator.authenticate("siwe", request, {
    successRedirect: "/",
    failureRedirect: "/login",
    context, // optional
  });
};
```

From your login entry point send `message` and `signature` as formData:

```typescript
   import { useSubmit } from '@remix-run/react';
   import { SiweMessage } from 'siwe';


   export default function Screen() {
      const submit = useSubmit();

      function authenticate = useCallback(() => {
         // create siwe message
         const message = await new SiweMessage({ siweMessageOptions });
         // sign siwe message
         const signature = await signer.signMessage(message);

         const formData = new FormData();
         formData.append('message', message);
         formData.append('signature', signature);
         submit(formData, {
            action: {YOUR_LOGIN_ACTION},
            method: 'post',
            replace: true,
         });
      }, [submit])

      return <button onClick={authenticate}>Sign In</button>;
   }
```

You can check if the user is authenticated with `authenticator.isAuthenticated` and redirect to the dashboard if it is, or to login if it's not

```typescript
export let loader: LoaderFunction = async ({ request }) => {
  // If the user is already authenticated redirect to /dashboard
  // otherwise redirect to /login
  return await authenticator.isAuthenticated(request, {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  });
};
```

You can get user object from `authenticator.isAuthenticated`:

```typescript
let user = await authenticator.isAuthenticated(request, {
  failureRedirect: "/login",
});
```

## Installation

Install with npm or yarn:

```bash
  npm install @sloikaxyz/remix-auth-siwe siwe@^2.0.5 ethers@^5.6.8
  # or
  yarn add @sloikaxyz/remix-auth-siwe siwe@^2.0.5 ethers@^5.6.8
```
