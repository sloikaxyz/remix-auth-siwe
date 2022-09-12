import { SiweMessage } from "siwe";
import { VerifyOpts } from "siwe/dist/types";

export type VerifierCallbackFn = (
  err: Error | null,
  user: unknown,
  info?: unknown
) => void;

export type VerifierFn = (
  message: SiweMessage,
  callback: VerifierCallbackFn
) => void | Promise<void>;

export interface StrategyOptions {
  domain: string;
  provider?: VerifyOpts["provider"];
}
