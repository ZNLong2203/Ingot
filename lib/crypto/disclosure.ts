import { concat, encodeAbiParameters, keccak256, toHex, type Hex } from "viem";

/**
 * Selective disclosure for an emissions report.
 *
 * Each field becomes a salted leaf; the leaves form a Merkle tree whose root
 * the verifier signs and the registry stores. Later the operator can hand an
 * importer or a customs officer one field with its proof, and they can check
 * it against the on-chain root (CbamPassportRegistry.verifyDisclosure)
 * without learning any other field. The salt stops anyone from guessing a
 * hidden value by hashing candidates.
 *
 * Hashing matches OpenZeppelin's MerkleProof: pairs are sorted before
 * hashing, and leaves are double-hashed so a leaf can never be mistaken for
 * an inner node.
 */

export type FieldValue = string | number | bigint | boolean;

export interface Leaf {
  key: string;
  value: string;
  salt: Hex;
  leaf: Hex;
}

export interface Commitment {
  root: Hex;
  leaves: Leaf[];
  /** Every level of the tree, leaves first, kept so proofs can be cut later. */
  layers: Hex[][];
}

export interface Disclosure {
  key: string;
  value: string;
  salt: Hex;
  proof: Hex[];
}

export function hashLeaf(salt: Hex, key: string, value: string): Hex {
  return keccak256(
    keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "string" }, { type: "string" }], [salt, key, value])),
  );
}

function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() < b.toLowerCase() ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

/** Salts come from a secret seed, so the operator can recreate every proof from the seed alone. */
export function deriveSalt(seed: Hex, key: string): Hex {
  return keccak256(concat([seed, toHex(key)]));
}

export function commit(fields: Record<string, FieldValue>, seed: Hex): Commitment {
  const leaves = Object.entries(fields)
    .map(([key, v]) => {
      const value = String(v);
      const salt = deriveSalt(seed, key);
      return { key, value, salt, leaf: hashLeaf(salt, key, value) };
    })
    .sort((a, b) => (a.leaf < b.leaf ? -1 : 1));
  if (leaves.length === 0) throw new Error("Nothing to commit");

  const layers: Hex[][] = [leaves.map((l) => l.leaf)];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    layers.push(next);
  }
  return { root: layers[layers.length - 1][0], leaves, layers };
}

export function disclose(c: Commitment, key: string): Disclosure {
  let index = c.leaves.findIndex((l) => l.key === key);
  if (index < 0) throw new Error(`No field "${key}" in this commitment`);
  const { value, salt } = c.leaves[index];
  const proof: Hex[] = [];
  for (const layer of c.layers.slice(0, -1)) {
    const sibling = index ^ 1;
    if (sibling < layer.length) proof.push(layer[sibling]);
    index = Math.floor(index / 2);
  }
  return { key, value, salt, proof };
}

export function verifyDisclosure(root: Hex, d: Disclosure): boolean {
  let node = hashLeaf(d.salt, d.key, d.value);
  for (const sibling of d.proof) node = hashPair(node, sibling);
  return node.toLowerCase() === root.toLowerCase();
}
