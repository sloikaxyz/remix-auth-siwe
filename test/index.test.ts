import { createCookieSessionStorage } from "@remix-run/node";
import { SiweMessage, SiweResponse } from "siwe";

import { SiweStrategy } from "../src";

import { createAccount, getAccount } from "./utils/accounts";
import {
  DEFAULT_DOMAIN,
  DEFAULT_STRATEGY_OPTIONS,
  DEFAULT_URI,
} from "./utils/constants";
import { createSignInMessage, signMessage } from "./utils/signing-helpers";

jest.useFakeTimers();

type TResponseBody = {
  message: string;
};

describe("SiweStrategy", () => {
  const verify = jest.fn();
  const sessionStorage = createCookieSessionStorage({
    cookie: { secrets: ["s3cr3t"] },
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should have the name of the strategy", () => {
    const strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
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
    const siweMessage = createSignInMessage();
    const message = siweMessage.prepareMessage();
    const signer = getAccount(siweMessage.address);

    const invalidMessage = `${message}2`;
    const invalidSigner = createAccount();

    const strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
    let signature: string;
    let invalidSignature: string;

    beforeAll(async () => {
      signature = await signMessage(siweMessage, signer);
      invalidSignature = await signMessage(siweMessage, invalidSigner);
    });

    describe("request body validation", () => {
      it("rejects when no message provided", async () => {
        const body = new FormData();
        body.append("signature", signature);

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        try {
          await strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          });
        } catch (error) {
          expect(error).toEqual(
            Error('request formData "message" is not a string')
          );
        }
      });

      it("rejects when no signature provided", async () => {
        const body = new FormData();
        body.append("message", message);

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        try {
          await strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          });
        } catch (error) {
          expect(error).toEqual(
            Error('request formData "signature" is not a string')
          );
        }
      });
    });
    describe("signature validation", () => {
      it("should fail if message is invalid", async () => {
        const body = new FormData();
        body.append("message", invalidMessage);
        body.append("signature", signature);

        let invalidMessageError;
        try {
          new SiweMessage(invalidMessage);
        } catch (error) {
          invalidMessageError = error;
        }

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        try {
          await strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          });
        } catch (error) {
          expect(error).toEqual(invalidMessageError);
        }
      });

      it("should return 401 response with siwe error if signed by another address", async () => {
        const body = new FormData();
        body.append("message", message);
        body.append("signature", invalidSignature);

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        let verifyResult!: SiweResponse;
        await siweMessage
          .verify(
            {
              signature: invalidSignature,
              domain: DEFAULT_DOMAIN,
            },
            {
              suppressExceptions: true,
            }
          )
          .then((res) => (verifyResult = res));

        const verifyError = verifyResult.error?.type;

        if (typeof verifyError !== "string") {
          throw new Error();
        }

        try {
          await strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          });
        } catch (error) {
          if (!(error instanceof Response)) throw error;
          const body = (await error.json()) as TResponseBody;
          expect(error.status).toEqual(401);
          expect(body.message).toMatch(verifyError);
        }
      });
    });

    describe("success", () => {
      it("should pass message to the verify callback", async () => {
        const body = new FormData();
        body.append("message", message);
        body.append("signature", signature);

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        await strategy.authenticate(request, sessionStorage, {
          sessionKey: "user",
        });
        expect(verify).toBeCalledWith({ message: siweMessage });
      });

      it("should return user", async () => {
        const user = { address: siweMessage.address };
        verify.mockResolvedValueOnce(user);
        const strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
        const body = new FormData();
        body.append("message", message);
        body.append("signature", signature);

        const request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        const res = await strategy.authenticate(request, sessionStorage, {
          sessionKey: "user",
        });
        expect(res).toEqual(user);
      });
    });
  });
});
