import { Interface } from "ethers";
import { ABI } from "../config";

const iface = new Interface(ABI as never);

/** Maps the contract's custom errors to human-readable UI messages. */
const FRIENDLY: Record<string, (args: readonly unknown[]) => string> = {
  EmptyField: (a) => `Required field "${a[0]}" is empty.`,
  ZeroArea: () => "Area must be greater than zero.",
  DuplicateDocumentHash: () =>
    "This exact document is already registered on-chain. A deed file cannot be reused.",
  DuplicateSurveyLocation: (a) =>
    `This survey number and location are already registered (property #${a[0]}).`,
  PropertyNotFound: (a) => `Property #${a[0]} does not exist.`,
  NotPropertyOwner: () => "Only the current owner can perform this action.",
  PropertyNotRegistered: () => "The property must be Registered before it can be transferred.",
  PropertyNotPending: () => "This property is no longer pending — it has already been decided.",
  InvalidBuyer: () => "Buyer address is invalid (cannot be empty or the current owner).",
  TransferAlreadyPending: () => "A transfer is already pending for this property.",
  NoActivePendingTransfer: () => "There is no active pending transfer for this property.",
  NotDesignatedBuyer: () => "Only the designated buyer can accept this transfer.",
  ZeroAddressAccount: () => "Address cannot be the zero address.",
  AccessControlUnauthorizedAccount: () => "Your wallet is not authorised for this action (role required).",
  EnforcedPause: () => "The registry is currently paused by the Registrar.",
};

/** Decodes any thrown error (MetaMask / ethers / custom) into a friendly string. */
export function decodeError(err: unknown): string {
  const e = err as {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    data?: string;
    info?: { error?: { data?: string; message?: string } };
    message?: string;
  };

  // User rejected in the wallet.
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) {
    return "Transaction rejected in your wallet.";
  }

  const data = e?.data ?? e?.info?.error?.data;
  if (typeof data === "string" && data.startsWith("0x")) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        const fn = FRIENDLY[parsed.name];
        return fn ? fn(parsed.args as readonly unknown[]) : `${parsed.name}`;
      }
    } catch {
      /* fall through */
    }
  }

  // Sometimes ethers already extracts the name.
  const msg = e?.shortMessage || e?.reason || e?.message || "";
  for (const name of Object.keys(FRIENDLY)) {
    if (msg.includes(name)) return FRIENDLY[name]([]);
  }
  if (msg) return msg.split("\n")[0];
  return "Something went wrong. Please try again.";
}
