import { ethers } from "ethers";
import { generateNonce, SiweMessage } from "siwe";

import { getAccount } from "./accounts";
import {
  DEFAULT_ADDRESS,
  DEFAULT_CHAIN_ID,
  DEFAULT_DOMAIN,
  DEFAULT_URI,
} from "./constants";

export function createSignInMessage(
  message: Partial<SiweMessage> = {}
): SiweMessage {
  message.domain ??= DEFAULT_DOMAIN;
  message.address ??= DEFAULT_ADDRESS;
  message.uri ??= DEFAULT_URI;
  message.version ??= "1";
  message.chainId ??= DEFAULT_CHAIN_ID;
  message.nonce ??= generateNonce();

  return new SiweMessage(message);
}

export function signMessage(
  message: string | SiweMessage,
  signer?: ethers.Signer
): Promise<string> {
  if (!signer) {
    const signerAddressFromMessage =
      typeof message === "string"
        ? new SiweMessage(message).address
        : message.address;
    signer = getAccount(signerAddressFromMessage);

    if (!signer) {
      throw new Error(`signer not found: ${signerAddressFromMessage}`);
    }
  }

  return signer.signMessage(
    message instanceof SiweMessage ? message.prepareMessage() : message
  );
}

export async function createSignInPayload(
  messageParams: Partial<SiweMessage> = {},
  signer?: ethers.Signer
): Promise<{ siweMessage: SiweMessage; message: string; signature: string }> {
  const siweMessage = createSignInMessage(messageParams);
  const message = siweMessage.prepareMessage();
  const signature = await signMessage(
    message,
    signer ?? getAccount(siweMessage.address)
  );
  return { siweMessage, message, signature };
}
