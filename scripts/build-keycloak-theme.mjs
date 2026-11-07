import { cp, mkdir, readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const target = `${root}.artifacts/keycloak-theme/pocketledger`
// Fail packaging if hosted guidance/client constraints drift from provider policy.
const realm = JSON.parse(await readFile(`${root}infra/keycloak/pocketledger-realm.json`, 'utf8'))
const themeProperties = await readFile(`${root}infra/keycloak/themes/pocketledger/login/theme.properties`, 'utf8')
for (const [property, policy] of [['passwordMinimumLength', 'length'], ['passwordMaximumLength', 'maxLength']]) {
  const configured = realm.passwordPolicy.match(new RegExp(`(?:^| and )${policy}\\((\\d+)\\)`))?.[1]
  const displayed = themeProperties.match(new RegExp(`^${property}=(\\d+)$`, 'm'))?.[1]
  if (!configured || configured !== displayed) throw new Error(`Hosted ${property} must match the provider password policy.`)
}
await cp(`${root}infra/keycloak/themes/pocketledger`, target, { recursive: true })
await mkdir(`${target}/login/resources/css`, { recursive: true })
const files = (await readdir(`${root}src/PocketLedger.Web/dist/assets`)).filter(name => name.endsWith('.css'))
if (files.length !== 1) throw new Error('Build the Web production CSS before packaging the Keycloak theme.')
await cp(`${root}src/PocketLedger.Web/dist/assets/${files[0]}`, `${target}/login/resources/css/pocketledger.css`)
await cp(`${root}src/PocketLedger.Web/public/pocketledger-mark.svg`, `${target}/login/resources/pocketledger-mark.svg`)
console.log('Packaged Keycloak theme from shared production CSS and SVG.')
