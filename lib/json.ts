/** JSON that keeps bigints (as {"$big": "123"}), for journals and saved demo state. */
export function serialize(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { $big: x.toString() } : x));
}

export function deserialize(s: string): unknown {
  return JSON.parse(s, (_k, x) => (x && typeof x === "object" && "$big" in x ? BigInt(x.$big) : x));
}
