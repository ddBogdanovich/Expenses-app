// Reconcile owned preview policy and browser URLs; never modify users or credentials.
import { readFile } from 'node:fs/promises'
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
const template = JSON.parse(await readFile(new URL('../infra/keycloak/pocketledger-realm.json', import.meta.url), 'utf8'))
const realmURL = `${KEYCLOAK_URL}/admin/realms/pocketledger`
async function admin(path, method = 'GET', body) {
  const result = await fetch(`${realmURL}${path}`, {
    method, headers, signal: AbortSignal.timeout(identityRequestTimeoutMs),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!result.ok) throw new Error(`Identity policy configuration failed (${result.status}).`)
  return result.status === 204 || result.headers.get('content-length') === '0' ? undefined : result.json()
}
// New versioned flow aliases are owned by this file. Never edit built-in flows.
const flows = await admin('/authentication/flows')
const registrationFlow = template.registrationFlow
const formFlow = template.authenticationFlows.find(flow => !flow.topLevel)
if (!flows.some(flow => flow.alias === registrationFlow)) {
  await admin('/authentication/flows', 'POST', {
    alias: registrationFlow, providerId: 'basic-flow', topLevel: true, builtIn: false,
    description: 'PocketLedger email/password registration policy v2',
  })
}
const parentExecutions = await admin(`/authentication/flows/${registrationFlow}/executions`)
if (!parentExecutions.some(execution => execution.displayName === formFlow.alias)) {
  await admin(`/authentication/flows/${registrationFlow}/executions/flow`, 'POST', {
    alias: formFlow.alias, type: 'form-flow', provider: 'registration-page-form',
  })
}
let executions = await admin(`/authentication/flows/${formFlow.alias}/executions`)
for (const desired of formFlow.authenticationExecutions) {
  if (!executions.some(execution => execution.providerId === desired.authenticator)) {
    await admin(`/authentication/flows/${formFlow.alias}/executions/execution`, 'POST', { provider: desired.authenticator })
  }
}
executions = await admin(`/authentication/flows/${registrationFlow}/executions`)
const expectedProviders = new Set(formFlow.authenticationExecutions.map(execution => execution.authenticator))
for (const execution of executions) {
  if (execution.displayName !== formFlow.alias && !expectedProviders.has(execution.providerId)) {
    throw new Error('Unexpected execution in the owned registration flow; manual review required.')
  }
  if (execution.requirement !== 'REQUIRED') {
    await admin(`/authentication/flows/${registrationFlow}/executions`, 'PUT', { ...execution, requirement: 'REQUIRED' })
  }
}
const desiredProfile = JSON.parse(template.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0])
const profile = await admin('/users/profile')
// Compare only owned profile fields; Keycloak adds defaults to its representation.
function matchesOwnedFields(actual, desired) {
  if (Array.isArray(desired)) return Array.isArray(actual) && actual.length === desired.length && desired.every((value, index) => matchesOwnedFields(actual[index], value))
  if (desired && typeof desired === 'object') return actual && Object.keys(desired).every(key => matchesOwnedFields(actual[key], desired[key]))
  return actual === desired
}
if (!matchesOwnedFields(profile.attributes, desiredProfile.attributes) || (profile.unmanagedAttributePolicy ?? null) !== desiredProfile.unmanagedAttributePolicy) {
  await admin('/users/profile', 'PUT', desiredProfile)
}
const policyFields = ['registrationAllowed', 'registrationEmailAsUsername', 'loginWithEmailAllowed',
  'duplicateEmailsAllowed', 'editUsernameAllowed', 'resetPasswordAllowed', 'rememberMe', 'verifyEmail', 'passwordPolicy', 'registrationFlow']
const realm = await admin('')
const policy = Object.fromEntries(policyFields.map(field => [field, template[field]]))
if (policyFields.some(field => realm[field] !== policy[field])) await admin('', 'PUT', policy)
const clients = await admin('/clients?clientId=pocketledger-web')
if (clients.length !== 1) throw new Error('Expected exactly one PocketLedger browser client.')
const client = clients[0]
const redirectUris = [`${POCKETLEDGER_WEB_ORIGIN}/api/auth/preview/callback`]
const postLogout = `${POCKETLEDGER_WEB_ORIGIN}/api/auth/preview/signed-out`
const clientPolicy = { standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false }
if (JSON.stringify(client.redirectUris) !== JSON.stringify(redirectUris) || client.attributes?.['post.logout.redirect.uris'] !== postLogout ||
    Object.keys(clientPolicy).some(field => client[field] !== clientPolicy[field]) || client.attributes?.['pkce.code.challenge.method'] !== 'S256') {
  await admin(`/clients/${encodeURIComponent(client.id)}`, 'PUT', {
    ...client, ...clientPolicy, redirectUris,
    attributes: { ...client.attributes, 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': postLogout },
  })
}
console.log('PocketLedger registration policy and client URLs verified; users and credentials unchanged.')
