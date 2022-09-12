import { createCookieSessionStorage } from "@remix-run/node";
import { Authenticator, Strategy } from "remix-auth";
import { SiweMessage } from "siwe";

import { SiweStrategy } from "../src";
import { getAccount } from "./utils/accounts";
import {
  DEFAULT_DOMAIN,
  DEFAULT_STRATEGY_OPTIONS,
  DEFAULT_URI,
} from "./utils/constants";
import { createSignInMessage, signMessage } from "./utils/signing-helpers";

describe("SiweStrategy", () => {
  let verify = jest.fn();
  // You will probably need a sessionStorage to test the strategy.
  let sessionStorage = createCookieSessionStorage({
    cookie: { secrets: ["s3cr3t"] },
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("should have the name of the strategy", () => {
    let strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
    expect(strategy.name).toBe("siwe");
  });

  describe("options validation", () => {
    it("rejects a null options", () => {
      // @ts-expect-error -- options shouldn't be null
      expect(() => new SiweStrategy(null, verify)).toThrow(
        /invalid options object/
      );
    });
    it("rejects options without a domain", () => {
      // @ts-expect-error -- domain is required
      expect(() => new SiweStrategy({}, verify)).toThrow(
        /invalid options object/
      );
    });
    it("rejects a null verify function", () => {
      expect(
        // @ts-expect-error -- a verify function is required
        () => new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, null)
      ).toThrow(/verify is not a function/);
    });
    it("rejects a malformed provider", function () {
      const options = {
        ...DEFAULT_STRATEGY_OPTIONS,
        provider: null,
      };

      expect(
        () =>
          // @ts-expect-error -- provider type incompatible
          new SiweStrategy(options, verify)
      ).toThrow(/invalid options object/);
    });
  });

  describe("authenticate", () => {
    describe("request body validation", () => {
      const message = createSignInMessage();
      const signer = getAccount(message.address);
      test("should pass to the verify callback SiweMessage", async () => {
        const signature = await signMessage(message, signer);
        let body = new FormData();
        body.append("message", message.prepareMessage());
        body.append("signature", signature);

        let request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        let strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);

        await strategy.authenticate(request, sessionStorage, {
          sessionKey: "user",
        });
        expect(verify).toBeCalledWith({ message });
      });
    });
  });
});
