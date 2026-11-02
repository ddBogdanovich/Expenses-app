import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const { gitleaks } = JSON.parse(readFileSync(new URL('./tool-versions.json', import.meta.url), 'utf8'))
const platform = process.platform === 'win32' ? 'windows' : process.platform
const target = `${platform}_${process.arch}`
const expectedChecksum = gitleaks.checksums[target]
const executable = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'
const destination = resolve(root, '.tools', `gitleaks-${gitleaks.version}`)
const binary = join(destination, executable)
const installed = spawnSync(binary, ['version'], { encoding: 'utf8' })

if (installed.status === 0 && installed.stdout.trim() === gitleaks.version) {
  console.log(`Gitleaks ${gitleaks.version} is already installed.`)
} else {
  if (!expectedChecksum) throw new Error(`No pinned Gitleaks release for ${target}.`)
  const temporary = mkdtempSync(join(tmpdir(), 'pocketledger-gitleaks-'))
  try {
    const extension = platform === 'windows' ? 'zip' : 'tar.gz'
    const asset = `gitleaks_${gitleaks.version}_${target}.${extension}`
    console.log(`Downloading ${asset} from the official Gitleaks release...`)
    const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${gitleaks.version}/${asset}`)
    if (!response.ok) throw new Error(`Gitleaks download failed: HTTP ${response.status}`)
    const archive = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(archive).digest('hex') !== expectedChecksum) {
      throw new Error('Gitleaks archive checksum does not match the pinned SHA-256.')
    }
    const archivePath = join(temporary, asset)
    writeFileSync(archivePath, archive)
    const extract = platform === 'windows'
      ? spawnSync('tar', ['-xf', archivePath, '-C', temporary], { stdio: 'inherit' })
      : spawnSync('tar', ['-xzf', archivePath, '-C', temporary, executable], { stdio: 'inherit' })
    if (extract.error || extract.status !== 0) throw new Error('Could not extract Gitleaks; ensure tar is installed.')
    mkdirSync(destination, { recursive: true })
    // Copy across filesystems; rename within the destination publishes the complete binary.
    writeFileSync(`${binary}.tmp`, readFileSync(join(temporary, executable)))
    chmodSync(`${binary}.tmp`, 0o755)
    renameSync(`${binary}.tmp`, binary)
    console.log(`Installed Gitleaks ${gitleaks.version} in .tools/.`)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}
