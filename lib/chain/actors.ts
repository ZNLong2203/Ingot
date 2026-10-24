import { keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/**
 * The cast of the demo. Their keys are derived from public strings, so they
 * are throwaway demo keys by construction: never fund them on a real network.
 */
export type Role = "authority" | "verifier" | "operator" | "importer" | "importer2";

export interface Actor {
  role: Role;
  name: string;
  detail: string;
  account: PrivateKeyAccount;
  address: Address;
}

const cast: Record<Role, { name: string; detail: string }> = {
  authority: { name: "Accreditation body", detail: "Admits and suspends verifiers" },
  verifier: { name: "Anatolia Verification Ltd.", detail: "Accredited CBAM verifier (fictional)" },
  operator: { name: "Marmara Demo Steel", detail: "EAF steel mill, Kocaeli, Türkiye (fictional)" },
  importer: { name: "Rhein Metals GmbH", detail: "Authorised CBAM declarant, Duisburg (fictional)" },
  importer2: { name: "Lombardia Tubi S.p.A.", detail: "Authorised CBAM declarant, Brescia (fictional)" },
};

function actor(role: Role): Actor {
  const account = privateKeyToAccount(keccak256(toHex(`climatechain-demo:${role}`)));
  return { role, ...cast[role], account, address: account.address };
}

export const actors: Record<Role, Actor> = {
  authority: actor("authority"),
  verifier: actor("verifier"),
  operator: actor("operator"),
  importer: actor("importer"),
  importer2: actor("importer2"),
};

export function actorByAddress(address: string): Actor | undefined {
  return Object.values(actors).find((a) => a.address.toLowerCase() === address.toLowerCase());
}
