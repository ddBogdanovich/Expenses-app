import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function report(source, coveredPath) {
  const file = source.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<?xml version="1.0"?>
<CoverageSession><Modules><Module hash="fixture">
<ModulePath>Coverage.MergeFixture.dll</ModulePath><ModuleName>Coverage.MergeFixture</ModuleName>
<Files><File uid="1" fullPath="${file}" /></Files><Classes><Class><FullName>Example</FullName><Methods>
<Method visited="true" cyclomaticComplexity="2" sequenceCoverage="100" branchCoverage="50" isConstructor="false" isStatic="true" isGetter="false" isSetter="false">
<MetadataToken>100663297</MetadataToken><Name>System.Int32 Example::Choose(System.Boolean)</Name><FileRef uid="1" />
<SequencePoints><SequencePoint vc="1" uspid="1" ordinal="0" sl="1" sc="1" el="1" ec="2" bec="2" bev="1" fileid="1" /></SequencePoints>
<BranchPoints>
<BranchPoint vc="${coveredPath === 0 ? 1 : 0}" uspid="1" ordinal="0" path="0" offset="1" offsetend="2" sl="1" fileid="1" />
<BranchPoint vc="${coveredPath === 1 ? 1 : 0}" uspid="1" ordinal="1" path="1" offset="1" offsetend="3" sl="1" fileid="1" />
</BranchPoints></Method></Methods></Class></Classes></Module></Modules></CoverageSession>`
}

/** Proves the actual pinned merger unions branch identities without adding denominators. */
export function verifyMergeContract(toolingRoot) {
  const temporary = mkdtempSync(join(tmpdir(), 'pocketledger-coverage-merge-'))
  try {
    const source = join(temporary, 'Fixture.cs')
    writeFileSync(source, 'internal static class Example { public static int Choose(bool value) => value ? 1 : 0; }\n')
    const left = join(temporary, 'left.xml')
    const right = join(temporary, 'right.xml')
    writeFileSync(left, report(source, 0))
    writeFileSync(right, report(source, 1))
    for (const [name, inputs, coveredBranches] of [['opposite-paths', [left, right], 2], ['duplicate-paths', [left, left], 1]]) {
      const output = join(temporary, name)
      const result = spawnSync('dotnet', ['tool', 'run', 'reportgenerator', `-reports:${inputs.join(';')}`, `-targetdir:${output}`, '-reporttypes:JsonSummary'],
        { cwd: toolingRoot, encoding: 'utf8' })
      if (result.error || result.status !== 0) throw new Error('ReportGenerator merge contract could not run.')
      const summary = JSON.parse(readFileSync(join(output, 'Summary.json'), 'utf8')).summary
      if (summary.coveredlines !== 1 || summary.coverablelines !== 1 || summary.coveredbranches !== coveredBranches || summary.totalbranches !== 2) {
        throw new Error(`ReportGenerator failed the ${name} branch-union contract.`)
      }
    }
    console.log('Coverage merge contract passed: opposite paths 2/2; duplicate paths 1/2; one executable line.')
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}
