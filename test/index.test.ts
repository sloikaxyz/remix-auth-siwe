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

describe("SiweStrategy", () => {
  let verify = jest.fn();
  let sessionStorage = createCookieSessionStorage({
    cookie: { secrets: ["s3cr3t"] },
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should have the name of the strategy", () => {
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
    const siweMessage = createSignInMessage();
    const message = siweMessage.prepareMessage();
    const signer = getAccount(siweMessage.address);

    const invalidMessage = `${message}2`;
    const invalidSigner = createAccount();

    let strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
    let signature: string;
    let invalidSignature: string;

    beforeAll(async () => {
      signature = await signMessage(siweMessage, signer);
      invalidSignature = await signMessage(siweMessage, invalidSigner);
    });

    describe("request body validation", () => {
      it("rejects when no message provided", async () => {
        let body = new FormData();
        body.append("signature", signature);

        let request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        expect(
          strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          })
        ).rejects.toEqual(Error('request formData "message" is not a string'));
      });

      it("rejects when no signature provided", async () => {
        let body = new FormData();
        body.append("message", message);

        let request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        expect(
          strategy.authenticate(request, sessionStorage, {
            sessionKey: "user",
          })
        ).rejects.toEqual(
          Error('request formData "signature" is not a string')
        );
      });
    });
    describe("signature validation", () => {
      it("should fail if message is invalid", async () => {
        let body = new FormData();
        body.append("message", invalidMessage);
        body.append("signature", signature);

        let invalidMessageError;
        try {
          new SiweMessage(invalidMessage);
        } catch (error) {
          invalidMessageError = error;
        }

        let request = new Request(DEFAULT_URI, {
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
        let body = new FormData();
        body.append("message", message);
        body.append("signature", invalidSignature);

        let request = new Request(DEFAULT_URI, {
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
          const body = await error.json();
          expect(error.status).toEqual(401);
          expect(body.message).toMatch(verifyError);
        }
      });
    });

    describe("success", () => {
      it("should pass message to the verify callback", async () => {
        let body = new FormData();
        body.append("message", message);
        body.append("signature", signature);

        let request = new Request(DEFAULT_URI, {
          body,
          method: "POST",
        });

        await strategy.authenticate(request, sessionStorage, {
          sessionKey: "user",
        });
        expect(verify).toBeCalledWith({ message: siweMessage });
      });

      it("should return user", async () => {
        let user = { address: siweMessage.address };
        verify.mockResolvedValueOnce(user);
        let strategy = new SiweStrategy(DEFAULT_STRATEGY_OPTIONS, verify);
        let body = new FormData();
        body.append("message", message);
        body.append("signature", signature);

        let request = new Request(DEFAULT_URI, {
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
