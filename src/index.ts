import { ethers } from "ethers";
import { SessionStorage } from "@remix-run/server-runtime";
import {
  AuthenticateOptions,
  Strategy as AbstractStrategy,
  StrategyVerifyCallback,
} from "remix-auth";
import { SiweError, SiweMessage } from "siwe";

import { StrategyOptions, VerifierCallbackFn } from "./types";

type VerifierFn = {
  message: SiweMessage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStrategyOptions(value: unknown): value is StrategyOptions {
  return (
    // options must be a non-null object
    isRecord(value) &&
    // the domain is required
    typeof value.domain === "string" &&
    // provider is optional, but must be an ethers provider if it is provided
    (typeof value.provider === "undefined" ||
      ethers.providers.Provider.isProvider(value.provider))
  );
}

export class SiweStrategy<User> extends AbstractStrategy<User, VerifierFn> {
  name = "siwe";

  private options: StrategyOptions;
  verify: StrategyVerifyCallback<User, VerifierFn>;

  constructor(
    options: StrategyOptions,
    verify: StrategyVerifyCallback<User, VerifierFn>
  ) {
    super(verify);

    if (!isStrategyOptions(options)) {
      throw new Error("invalid options object");
    }

    if (typeof verify !== "function") {
      throw new Error("verify is not a function");
    }

    this.options = options;
    this.verify = verify;
  }

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions
  ): Promise<User> {
    const formData = await request.formData();
    if (!isRecord(formData)) {
      return await this.failure(
        "request formData is not an object",
        request,
        sessionStorage,
        options
      );
    }

    const message = formData.get("message");
    if (typeof message !== "string") {
      return await this.failure(
        'request formData "message" is not a string',
        request,
        sessionStorage,
        options
      );
    }
    const signature = formData.get("signature");
    if (typeof signature !== "string") {
      return await this.failure(
        'request formData "signature" is not a string',
        request,
        sessionStorage,
        options
      );
    }

    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch (err) {
      console.error("siweMessage error", err);
      // SiweMessage constructor throws a SiweError an object-type message is invalid
      // https://github.com/spruceid/siwe/blob/23f7e17163ea15456b4afed3c28fb091b39feee3/packages/siwe/lib/client.ts#L352
      if (err instanceof SiweError) {
        return await this.failure(err.type, request, sessionStorage, options);
      }

      // SiweMessage constructor throws a generic Error if string message syntax is invalid
      // https://github.com/spruceid/siwe/blob/23f7e17163ea15456b4afed3c28fb091b39feee3/packages/siwe-parser/lib/abnf.ts#L327
      // the string message is parsed using the grammar defined in here:
      // https://github.com/spruceid/siwe/blob/23f7e17163ea15456b4afed3c28fb091b39feee3/packages/siwe-parser/lib/abnf.ts#L23)
      if (err instanceof Error) {
        return await this.failure(
          err.message,
          request,
          sessionStorage,
          options
        );
      }

      return await this.failure(
        `SiweMessage constructor threw an unexpected error: ${String(err)}`,
        request,
        sessionStorage,
        options
      );
    }
    let user = {} as User;
    await siweMessage
      .verify(
        {
          signature,
          domain: this.options.domain,
        },
        {
          provider: this.options.provider,
          suppressExceptions: true,
        }
      )
      .then(async (siweResponse) => {
        if (!siweResponse.success && !siweResponse.error) {
          return await this.failure(
            "siweResponse.success is false but no error was specified",
            request,
            sessionStorage,
            options
          );
        }

        if (siweResponse.error) {
          const { error } = siweResponse;
          return await this.failure(
            error.type,
            request,
            sessionStorage,
            options
          );
        }

        const { data } = siweResponse;

        user = await this.verify({ message: data });
        console.log("siwe verify user:", user);
        // return user;
      })
      .catch(async (err: unknown) => {
        console.log("siwe verify error:", err);
        if (err instanceof Error) {
          return await this.failure(
            err.message,
            request,
            sessionStorage,
            options
          );
        }

        if (typeof err === "string") {
          return await this.failure(err, request, sessionStorage, options);
        }

        return this.failure(
          `SiweMessage.verify rejected the promise with an unknown error: ${String(
            err
          )}`,
          request,
          sessionStorage,
          options
        );
      });

    return this.success(user, request, sessionStorage, options);
  }
}
