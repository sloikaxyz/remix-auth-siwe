import { ethers } from "ethers";

const accounts = new Map<string, ethers.Wallet>();

export function createAccount(): ethers.Wallet {
  const wallet = ethers.Wallet.createRandom();
  accounts.set(wallet.address, wallet);

  return wallet;
}

export function getAccount(address: string): ethers.Wallet | undefined {
  return accounts.get(address);
}
