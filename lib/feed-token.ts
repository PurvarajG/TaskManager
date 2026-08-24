const encoder = new TextEncoder();

/** Compare feed tokens without exposing where a mismatch occurs. */
export async function matchesFeedToken(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const candidateBytes = new Uint8Array(candidateHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < expectedBytes.length; i++) {
    difference |= candidateBytes[i] ^ expectedBytes[i];
  }
  return difference === 0;
}
