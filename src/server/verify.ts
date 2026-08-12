import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import bs58 from "bs58";
import { getServerConnection, serverUsdcMint, USDC_DECIMALS } from "./solana";

/**
 * Server-side, on-chain deposit verification. NEVER trusts the client: given a
 * transaction signature it fetches the parsed transaction from the RPC and
 * verifies, from the transaction data itself, that:
 *
 *   - the transaction succeeded (meta.err === null),
 *   - the recipient is this task's escrow (for USDC: the escrow's associated
 *     token account for the configured USDC mint),
 *   - the total amount that moved to the escrow equals the expected amount
 *     (SOL in lamports, USDC in 1e6 base units),
 *   - the currency matches the task (a SOL transfer cannot fund a USDC task:
 *     there is no spl-token transfer to the escrow ATA, and vice versa).
 *
 * The escrow address passed in is server state (attached when the task was
 * created), so a client cannot claim a different recipient.
 */

export type Currency = "SOL" | "USDC";

export type DepositErrorCode =
  | "invalid_signature"
  | "not_found"
  | "failed"
  | "wrong_recipient"
  | "wrong_amount"
  | "wrong_currency"
  | "rpc_error";

export class DepositVerificationError extends Error {
  constructor(
    public code: DepositErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DepositVerificationError";
  }
}

export type VerifiedDeposit = {
  signature: string;
  currency: Currency;
  /** Total amount that moved to the escrow, in lamports / base units. */
  amount: string;
  /** The account that paid (SOL: funder wallet; USDC: funder's token account). */
  from: string;
  /** The escrow wallet (SOL) or the escrow's USDC ATA (USDC). */
  to: string;
  slot: number;
  blockTime: number | null;
};

export function isValidSignature(signature: string): boolean {
  if (typeof signature !== "string" || signature.length < 64 || signature.length > 128) {
    return false;
  }
  try {
    const bytes = bs58.decode(signature);
    return bytes.length === 64;
  } catch {
    return false;
  }
}

type ParsedInstructionLike = {
  program?: string;
  parsed?: {
    type?: string;
    info?: Record<string, unknown>;
  };
};

function asParsedInstructionList(
  instructions: unknown
): ParsedInstructionLike[] {
  return Array.isArray(instructions) ? (instructions as ParsedInstructionLike[]) : [];
}

/** Sum the amounts of every transfer instruction that paid the destination. */
function sumTransfersTo(
  instructions: ParsedInstructionLike[],
  destination: string,
  currency: Currency,
  usdcMint: string
): { total: bigint; sources: string[]; matched: boolean } {
  let total = 0n;
  const sources: string[] = [];
  let matched = false;

  for (const ix of instructions) {
    const info = ix.parsed?.info;
    if (!info) continue;

    if (currency === "SOL" && ix.program === "system" && ix.parsed?.type === "transfer") {
      const dest = info.destination;
      if (typeof dest === "string" && dest === destination) {
        const lamports = Number(info.lamports ?? 0);
        if (Number.isFinite(lamports) && lamports > 0) {
          total += BigInt(Math.trunc(lamports));
          sources.push(String(info.source ?? ""));
          matched = true;
        }
      }
    }

    if (currency === "USDC" && ix.program === "spl-token") {
      const type = ix.parsed?.type;
      if (type === "transfer" || type === "transferChecked") {
        const dest = info.destination;
        const mint = info.mint;
        if (typeof dest === "string" && dest === destination) {
          // For transferChecked the mint is in the instruction; for transfer it
          // can only target this ATA if it is the same mint (ATAs are mint-specific).
          if (mint !== undefined && typeof mint === "string" && mint !== usdcMint) continue;
          let amountStr: string | null = null;
          const ta = info.tokenAmount as { amount?: string | number } | undefined;
          if (type === "transferChecked" && ta && ta.amount !== undefined) {
            amountStr = String(ta.amount);
          } else if (ta && ta.amount !== undefined) {
            amountStr = String(ta.amount);
          } else if (info.amount !== undefined) {
            amountStr = String(info.amount);
          }
          if (amountStr !== null && /^\d+$/.test(amountStr)) {
            total += BigInt(amountStr);
            sources.push(String(info.source ?? ""));
            matched = true;
          }
        }
      }
    }
  }
  return { total, sources, matched };
}

export async function verifyDeposit(params: {
  signature: string;
  escrowAddress: string;
  expectedAmount: string;
  currency: Currency;
  connection?: Connection;
}): Promise<VerifiedDeposit> {
  const { signature, escrowAddress, expectedAmount, currency } = params;
  const connection = params.connection ?? getServerConnection();

  if (!isValidSignature(signature)) {
    throw new DepositVerificationError(
      "invalid_signature",
      "signature is not a valid 64-byte base58 transaction signature"
    );
  }
  if (!/^\d+$/.test(expectedAmount)) {
    throw new DepositVerificationError(
      "wrong_amount",
      "expectedAmount must be a non-negative integer string"
    );
  }

  let escrowPubkey: PublicKey;
  try {
    escrowPubkey = new PublicKey(escrowAddress);
  } catch {
    throw new DepositVerificationError("wrong_recipient", "invalid escrow address");
  }

  let usdcMint = "";
  let escrowAta = "";
  if (currency === "USDC") {
    usdcMint = serverUsdcMint();
    try {
      escrowAta = (await getAssociatedTokenAddress(new PublicKey(usdcMint), escrowPubkey)).toBase58();
    } catch {
      throw new DepositVerificationError("wrong_currency", "invalid USDC mint configuration");
    }
  }

  let tx: Awaited<ReturnType<Connection["getParsedTransaction"]>>;
  try {
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    throw new DepositVerificationError(
      "rpc_error",
      `could not fetch transaction from the RPC: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!tx) {
    throw new DepositVerificationError(
      "not_found",
      "transaction not found on-chain — is the signature real and confirmed?"
    );
  }

  if (tx.meta?.err) {
    throw new DepositVerificationError(
      "failed",
      `transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`
    );
  }

  const message = tx.transaction.message;
  const accountKeys = message.accountKeys;
  const allInstructions = [
    ...asParsedInstructionList(message.instructions),
    ...(tx.meta?.innerInstructions ?? []).flatMap((inner) =>
      asParsedInstructionList(inner.instructions)
    ),
  ];

  const destination = currency === "SOL" ? escrowAddress : escrowAta;
  const { total, sources, matched } = sumTransfersTo(
    allInstructions,
    destination,
    currency,
    usdcMint
  );

  if (!matched) {
    throw new DepositVerificationError(
      "wrong_recipient",
      currency === "SOL"
        ? `no SOL transfer to escrow ${escrowAddress} found in this transaction`
        : `no USDC transfer to the escrow's token account (${escrowAta}) found in this transaction`
    );
  }

  const expected = BigInt(expectedAmount);
  if (total !== expected) {
    throw new DepositVerificationError(
      "wrong_amount",
      `transferred ${total} ${currency === "SOL" ? "lamports" : "base units"} to escrow, expected ${expectedAmount}`
    );
  }

  // from_addr: for SOL the paying wallet; for USDC resolve the token account's
  // owner when possible (the funder's wallet address).
  let from = sources.find((s) => s) ?? accountKeys[0]?.pubkey?.toBase58?.() ?? "";
  if (currency === "USDC") {
    try {
      const src = new PublicKey(from);
      const info = await connection.getAccountInfo(src);
      if (info && info.data.length >= 165) {
        const layout = await import("@solana/spl-token");
        const account = layout.AccountLayout.decode(info.data);
        from = new PublicKey(account.owner).toBase58();
      }
    } catch {
      // keep the token account address as the fallback
    }
  }

  return {
    signature,
    currency,
    amount: total.toString(),
    from,
    to: destination,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
  };
}

/** Human-readable explanation of a verification failure for API consumers. */
export function depositErrorDetail(err: DepositVerificationError): string {
  switch (err.code) {
    case "invalid_signature":
      return "The signature format is invalid.";
    case "not_found":
      return "Transaction not found on-chain. Double-check the signature.";
    case "failed":
      return "The transaction failed on-chain, so no payment was made.";
    case "wrong_recipient":
      return "The transaction does not pay this task's escrow.";
    case "wrong_amount":
      return "The amount paid does not match the task bounty.";
    case "wrong_currency":
      return "The transaction does not match the task's currency.";
    case "rpc_error":
      return "Could not verify the transaction (RPC error). Try again shortly.";
    default:
      return err.message;
  }
}

export { USDC_DECIMALS };
