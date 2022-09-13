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

```
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

To authenticate a user:

```
   export const action: ActionFunction = async ({ request, context }) => {
      await authenticator.authenticate("siwe", request, {
         successRedirect: "/",
         failureRedirect: "/login",
         context, // optional
      });
   };

```

## Scripts

- `build`: Build the project for production using the TypeScript compiler (strips the types).
- `typecheck`: Check the project for type errors, this also happens in build but it's useful to do in development.
- `lint`: Runs ESLint against the source codebase to ensure it pass the linting rules.
- `test`: Runs all the test using Jest.
