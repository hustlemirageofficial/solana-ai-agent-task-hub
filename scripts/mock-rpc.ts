/**
 * Shared Solana JSON-RPC mock for AgentPay verification scripts.
 *
 * Runs a real local HTTP server (Bun.serve on a random loopback port) that
 * speaks the Solana JSON-RPC methods web3.js issues — getBalance /
 * getLatestBlockhash / sendTransaction / getSignatureStatuses / getAccountInfo
 * / getTokenAccountsByOwner. Verification scripts set:
 *
 *   process.env.SOLANA_RPC = mockRpcUrl();   // before any DB-backed API call
 *
 * so `getServerConnection()` (src/server/solana.ts) creates its Connection
 * against the mock. This avoids fighting @solana/web3.js, which captures
 * `fetchImpl = globalThis.fetch` at module load — overriding globalThis.fetch
 * after web3.js has loaded has NO effect on Connection calls.
 *
 * Usage (in a bun:test script):
 *   import { setRpcState, mockRpcUrl, stopMockRpc, type RpcState } from "./mock-rpc";
 *   setRpcState({ balances: new Map([[escrow, 5_000_000_000n]]), ... });
 */
import bs58 from "bs58";

export const MOCK_RPC_URL = "https://api.devnet.solana.com";

/** Any valid 32-byte blockhash (deterministic, non-zero) used by the mock RPC. */
export const BLOCKHASH: string = bs58.encode(new Uint8Array(32).fill(7));

export type RpcState = {
  /** address (base58) → SOL lamports */
  balances: Map<string, bigint>;
  /** token account address (base58) → USDC base units */
  tokenBalances: Map<string, bigint>;
  /** accounts that exist on-chain (used for recipient-ATA existence checks) */
  existingAccounts: Set<string>;
  /** simulate a broadcast failure (sendTransaction throws) */
  failSend?: boolean;
  /** on-chain failure reported by getSignatureStatuses */
  statusErr?: unknown;
  /** capture every broadcast transaction (decoded later for instruction checks) */
  sentTxs?: { base64: string; raw: Uint8Array }[];
  /** if set, sendTransaction awaits this promise (concurrency tests) */
  gateSend?: Promise<void>;
};

let current: RpcState | null = null;

export function setRpcState(state: RpcState): void {
  current = state;
}

export function rpcState(): RpcState {
  if (!current) throw new Error("mock-rpc: no RpcState set — call setRpcState first");
  return current;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function handleRpc(body: unknown): Response {
  const req = body as { id: number; method: string; params: unknown[] };
  if (!req || typeof req.method !== "string") {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } });
  }
  const state = rpcState();
  const ok = (result: unknown) => jsonResponse({ jsonrpc: "2.0", id: req.id, result });
  switch (req.method) {
    case "getBalance": {
      const addr = String((req.params as unknown[])[0]);
      return ok({ context: { slot: 1 }, value: Number(state.balances.get(addr) ?? 0n) });
    }
    case "getLatestBlockhash": {
      return ok({
        context: { slot: 2 },
        value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1000 },
      });
    }
    case "sendTransaction": {
      if (state.gateSend) return new Promise<Response>((resolve) => {
        state.gateSend!.then(() => resolve(doSend(req, state)));
      });
      return doSend(req, state);
    }
    case "getSignatureStatuses": {
      return ok({
        context: { slot: 3 },
        value: [
          {
            slot: 3,
            confirmations: null,
            err: state.statusErr ?? null,
            confirmationStatus: state.statusErr ? "confirmed" : "finalized",
          },
        ],
      });
    }
    case "getTransaction": {
      // Deposit verification (verify.ts → Connection.getParsedTransaction sends
      // RPC method "getTransaction"): the real RPC returns result:null for a
      // signature with no on-chain tx, so superstruct (GetParsedTransactionRpcResult)
      // expects `result` to be the parsed tx object — with slot at the top
      // level — or null. NOT a {context, value} wrapper (that shape fails
      // superstruct with "At path: slot"). → verifyDeposit throws not_found,
      // surfaced as 422.
      return ok(null);
    }
    case "getAccountInfo": {
      const addr = String((req.params as unknown[])[0]);
      return ok(
        state.existingAccounts.has(addr)
          ? {
              context: { slot: 1 },
              value: {
                data: ["", "base64"],
                executable: false,
                lamports: 2039280,
                owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                rentEpoch: 0,
              },
            }
          : { context: { slot: 1 }, value: null }
      );
    }
    case "getTokenAccountsByOwner": {
      const mint = ((req.params as unknown[])[1] as { mint?: string })?.mint ?? "";
      const accounts = [...state.tokenBalances.entries()].map(([addr, amt]) => ({
        pubkey: addr,
        account: {
          data: {
            program: "spl-token",
            parsed: {
              info: {
                mint,
                tokenAmount: { amount: String(amt), decimals: 6, uiAmount: Number(amt) / 1e6 },
              },
            },
            space: 165,
          },
          executable: false,
          lamports: 2039280,
          owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          rentEpoch: 0,
        },
      }));
      return ok({ context: { slot: 1 }, value: accounts });
    }
    default:
      return jsonResponse(
        { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `mock-rpc: unhandled method ${req.method}` } },
        400
      );
  }
}

function doSend(req: { id: number; method: string; params: unknown[] }, state: RpcState): Response {
  if (state.failSend) {
    return jsonResponse(
      { jsonrpc: "2.0", id: req.id, error: { code: -32000, message: "mock RPC: send failed" } },
      400
    );
  }
  const base64 = String((req.params as unknown[])[0]);
  const raw = Buffer.from(base64, "base64");
  state.sentTxs ??= [];
  state.sentTxs.push({ base64, raw });
  return jsonResponse({ jsonrpc: "2.0", id: req.id, result: "test-release-signature-123" });
}

let server: ReturnType<typeof Bun.serve> | null = null;

/** Start the mock RPC server (lazily) and return its loopback URL. */
export function mockRpcUrl(): string {
  if (!server) {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        if (req.method !== "POST") {
          return jsonResponse({ error: "method not allowed" }, 405);
        }
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
        }
        return handleRpc(body);
      },
    });
  }
  return `http://127.0.0.1:${server.port}`;
}

/** Stop the mock RPC server (call in afterAll so the test runner exits). */
export function stopMockRpc(): void {
  if (server) {
    server.stop(true);
    server = null;
  }
}
