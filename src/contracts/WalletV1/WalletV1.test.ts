import { PublicClient } from "../../clients/index.js";
import { generateRandomPrivateKey } from "../../index.js";
import { LocalECDSAKeySigner } from "../../signers/LocalECDSAKeySigner.js";
import { MockTransport } from "../../transport/MockTransport.js";
import { HttpTransport } from "../../transport/index.js";
import { WalletV1 } from "./WalletV1.js";

const signer = new LocalECDSAKeySigner({
  privateKey: generateRandomPrivateKey(),
});
const pubkey = await signer.getPublicKey();
const client = new PublicClient({
  transport: new HttpTransport({
    endpoint: "http://127.0.0.1:8529",
  }),
  shardId: 1,
});

test("Wallet creation test with salt and no salt", async ({ expect }) => {
  describe("empty wallet creation", () => {
    expect(() => new WalletV1({})).toThrowError();
  });
  describe("wallet creation with address and salt", () => {
    expect(
      () =>
        new WalletV1({
          pubkey: pubkey,
          salt: 100n,
          shardId: 1,
          client,
          signer,
          address: WalletV1.calculateWalletAddress({
            pubKey: pubkey,
            shardId: 1,
            salt: 100n,
          }),
        }),
    ).toThrowError();
  });

  expect(
    () =>
      new WalletV1({
        pubkey: pubkey,
        salt: 100n,
        shardId: 1,
        client,
        signer,
      }),
  ).toBeDefined();

  expect(
    () =>
      new WalletV1({
        pubkey: pubkey,
        client,
        signer,
        address: WalletV1.calculateWalletAddress({
          pubKey: pubkey,
          shardId: 1,
          salt: 100n,
        }),
      }),
  ).toBeDefined();

  expect(
    () =>
      new WalletV1({
        pubkey: pubkey,
        client,
        signer,
        address: WalletV1.calculateWalletAddress({
          pubKey: pubkey,
          shardId: 1,
          salt: 100n,
        }),
      }),
  ).toBeDefined();
});

test("Wallet self deploy test", async ({ expect }) => {
  const wallet = new WalletV1({
    pubkey: pubkey,
    client,
    signer,
    address: WalletV1.calculateWalletAddress({
      pubKey: pubkey,
      shardId: 1,
      salt: 100n,
    }),
  });

  await expect(async () => {
    await wallet.selfDeploy(true);
  }).rejects.toThrowError();
});

test("Deploy through wallet", async ({ expect }) => {
  const fn = vi.fn();

  const client = new PublicClient({
    transport: new MockTransport(fn),
  });
  const wallet = new WalletV1({
    pubkey: pubkey,
    client,
    signer,
    address: WalletV1.calculateWalletAddress({
      pubKey: pubkey,
      shardId: 1,
      salt: 100n,
    }),
  });
  await wallet.deployContract({
    abi: [],
    bytecode:
      "0x222222222222222222222222222222222222222222222222222222222222222222",
    args: [],
    chainId: 1,
    seqno: 1,
    salt: 100n,
    shardId: 1,
    value: 100n,
    gas: 100_000n,
  });
  expect(fn.mock.calls).toHaveLength(1);
  expect(fn.mock.calls[0][0].method).toBe("eth_sendRawTransaction");
  expect(fn.mock.calls[0][0].params[0]).toContain([
    "222222222222222222222222222222222222222222222222222222222222222222",
  ]);
});
