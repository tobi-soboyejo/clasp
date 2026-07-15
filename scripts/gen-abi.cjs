// Regenerates web/src/lib/abi.ts and abi-board.ts from Foundry artifacts.
const fs = require('fs');
function gen(artifact, out, exportName) {
  const art = JSON.parse(fs.readFileSync(artifact, 'utf8'));
  fs.writeFileSync(out,
    `// Generated from ${artifact}\n// Regenerate: node scripts/gen-abi.cjs\n` +
    `export const ${exportName} = ` + JSON.stringify(art.abi, null, 2) + ' as const;\n');
  console.log(out, 'regenerated');
}
gen('contracts/out/ClaspRegistry.sol/ClaspRegistry.json', 'web/src/lib/abi.ts', 'claspAbi');
gen('contracts/out/ClaspBoard.sol/ClaspBoard.json', 'web/src/lib/abi-board.ts', 'boardAbi');
