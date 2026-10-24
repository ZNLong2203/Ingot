import { keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/**
 * The cast of the demo. Their keys are derived from public strings, so they
 * are throwaway demo keys by construction: never fund them on a real network.
 */
export type Role = "authority" | "verifier" | "verifier2" | "supplier" | "operator" | "importer" | "importer2";

export interface Actor {
  role: Role;
  name: string;
  detail: string;
  account: PrivateKeyAccount;
  address: Address;
}

const cast: Record<Role, { name: string; detail: string }> = {
  authority: { name: "Accreditation registry", detail: "Mirrors EU national accreditation bodies; admits and suspends verifiers" },
  verifier: { name: "Anatolia Verification Ltd.", detail: "CBAM verifier accredited by an EU national accreditation body (fictional)" },
  verifier2: { name: "Atlântico Verificação Ltda.", detail: "CBAM verifier for the smelter (fictional)" },
  supplier: { name: "Demo Gusa Ltda.", detail: "Merchant pig iron, Minas Gerais, Brazil (fictional)" },
  operator: { name: "Marmara Demo Steel", detail: "Scrap-based EAF mill with a hot strip mill, Kocaeli, Türkiye (fictional)" },
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
  verifier2: actor("verifier2"),
  supplier: actor("supplier"),
  operator: actor("operator"),
  importer: actor("importer"),
  importer2: actor("importer2"),
};

export function actorByAddress(address: string): Actor | undefined {
  return Object.values(actors).find((a) => a.address.toLowerCase() === address.toLowerCase());
}
