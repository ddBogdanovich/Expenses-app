// Reconcile only browser-facing client URLs. Never import over a realm or modify users.
const identityRequestTimeoutMs = 15_000
const { KEYCLOAK_URL, KEYCLOAK_ADMIN_PASSWORD, POCKETLEDGER_WEB_ORIGIN } = process.env
if (!KEYCLOAK_URL || !KEYCLOAK_ADMIN_PASSWORD || !POCKETLEDGER_WEB_ORIGIN) throw new Error('Identity configuration parameters are missing.')
const tokenResponse = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: KEYCLOAK_ADMIN_PASSWORD }),
  signal: AbortSignal.timeout(identityRequestTimeoutMs),
})
if (!tokenResponse.ok) throw new Error(`Identity bootstrap authentication failed (${tokenResponse.status}).`)
const { access_token: token } = await tokenResponse.json()
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const response = await fetch(`${KEYCLOAK_URL}/admin/realms/pocketledger/clients?clientId=pocketledger-web`, { headers, signal: AbortSignal.timeout(identityRequestTimeoutMs) })
if (!response.ok) throw new Error(`Identity client lookup failed (${response.status}).`)
const clients = await response.json()
if (clients.length !== 1) throw new Error('Expected exactly one PocketLedger browser client.')
const client = clients[0]
const redirectUris = [`${POCKETLEDGER_WEB_ORIGIN}/api/auth/preview/callback`]
const postLogout = `${POCKETLEDGER_WEB_ORIGIN}/api/auth/preview/signed-out`
if (JSON.stringify(client.redirectUris) !== JSON.stringify(redirectUris) || client.attributes?.['post.logout.redirect.uris'] !== postLogout) {
  const update = await fetch(`${KEYCLOAK_URL}/admin/realms/pocketledger/clients/${encodeURIComponent(client.id)}`, {
    method: 'PUT', headers, signal: AbortSignal.timeout(identityRequestTimeoutMs),
    body: JSON.stringify({ ...client, redirectUris, attributes: { ...client.attributes, 'post.logout.redirect.uris': postLogout } }),
  })
  if (!update.ok) throw new Error(`Identity client URL update failed (${update.status}).`)
}
console.log('PocketLedger client URLs verified; users and credentials unchanged.')
