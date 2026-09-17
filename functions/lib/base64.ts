export function encodeBase64(bytes: Uint8Array): string {
  let value = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(value);
}

export function encodeTextBase64(value: string): string {
  return encodeBase64(new TextEncoder().encode(value));
}
