const encoder = new TextEncoder()
const tokenLifetimeSeconds = 8 * 60 * 60

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(payload: string, passwordHash: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passwordHash),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

export async function createAdminToken(userId: string | number, passwordHash: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + tokenLifetimeSeconds
  const payload = `${userId}.${expiresAt}`
  return `${payload}.${await signPayload(payload, passwordHash)}`
}

export async function verifyAdminToken(db: any, token: string | null): Promise<boolean> {
  if (!token) return false

  const [userId, expiresAtValue, signature, extra] = token.split('.')
  const expiresAt = Number(expiresAtValue)
  if (!userId || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !/^[a-f\d]{64}$/i.test(signature || '') || extra) {
    return false
  }

  const user = await db.prepare('SELECT password, isAdmin FROM users WHERE id = ?').bind(userId).first()
  if (Number(user?.isAdmin) !== 1 || !user?.password) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(user.password)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16))
  return crypto.subtle.verify('HMAC', key, signatureBytes.buffer as ArrayBuffer, encoder.encode(`${userId}.${expiresAt}`))
}

export function getAdminToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization') || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null
}
