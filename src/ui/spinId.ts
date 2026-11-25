export function createSpinId(source: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto) {
  // The native UUID method is unavailable when a phone opens the LAN server over HTTP.
  return source.randomUUID?.() ?? Array.from(source.getRandomValues(new Uint32Array(4)),
    value => value.toString(16).padStart(8, '0')).join('')
}
