import { testEnv } from "../../test/testEnv.js";
import {
  Faucet,
  HttpTransport,
  LocalECDSAKeySigner,
  PublicClient,
  WalletV1,
  bytesToHex,
  convertEthToWei,
  generateRandomPrivateKey,
  waitTillCompleted,
} from "../index.js";
const client = new PublicClient({
  transport: new HttpTransport({
    endpoint: testEnv.endpoint,
  }),
  shardId: 1,
});

test("Async call to another shard send value", async () => {
  const faucet = new Faucet(client);

  const signer = new LocalECDSAKeySigner({
    privateKey: generateRandomPrivateKey(),
  });

  const pubkey = await signer.getPublicKey();

  const wallet = new WalletV1({
    pubkey: pubkey,
    salt: 100n,
    shardId: 1,
    client,
    signer,
  });
  const walletAddress = await wallet.getAddressHex();

  await faucet.withdrawToWithRetry(walletAddress, convertEthToWei(1));

  await wallet.selfDeploy(true);

  expect(walletAddress).toBeDefined();

  const anotherAddress = WalletV1.calculateWalletAddress({
    pubKey: pubkey,
    shardId: 2,
    salt: 200n,
  });

  const hash = await wallet.sendMessage({
    to: anotherAddress,
    value: 50_000_000n,
    gas: 100_000n,
  });

  const receipts = await waitTillCompleted(client, 1, hash);

  expect(receipts).toBeDefined();
  expect(receipts.some((r) => !r.success)).toBe(false);

  const balance = await client.getBalance(bytesToHex(anotherAddress), "latest");
  expect(balance).toBeGreaterThan(0n);
});

test("sync call same shard send value", async () => {
  const faucet = new Faucet(client);

  const signer = new LocalECDSAKeySigner({
    privateKey: generateRandomPrivateKey(),
  });

  const pubkey = await signer.getPublicKey();

  const wallet = new WalletV1({
    pubkey: pubkey,
    salt: 100n,
    shardId: 1,
    client,
    signer,
  });
  const walletAddress = await wallet.getAddressHex();

  await faucet.withdrawToWithRetry(walletAddress, convertEthToWei(0.1));
  await wallet.selfDeploy(true);

  const anotherAddress = WalletV1.calculateWalletAddress({
    pubKey: pubkey,
    shardId: 1,
    salt: 200n,
  });

  const hash = await wallet.syncSendMessage({
    to: anotherAddress,
    value: 10n,
    gas: 100000n,
  });

  const receipts = await waitTillCompleted(client, 1, hash);

  expect(receipts).toBeDefined();
  expect(receipts.some((r) => !r.success)).toBe(false);
  const balance = await client.getBalance(bytesToHex(anotherAddress), "latest");

  expect(balance).toBe(10n);
});
