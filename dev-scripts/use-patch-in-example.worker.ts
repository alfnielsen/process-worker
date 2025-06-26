/**
 * This script applies a patch (local changes) to the example project.
 *
 * This make is easy to test local changes, without having to publish a new version of the package.
 */

import { $ } from "bun"
import { join } from "path"
import { findPackageJson } from "./util/findPackageJson"

const log = {
  gray: (msg: string) => console.log(`\x1b[90m${msg}\x1b[0m`),
  red: (msg: string) => console.error(`\x1b[31m${msg}\x1b[0m`),
  green: (msg: string) => console.log(`\x1b[32m${msg}\x1b[0m`),
  yellow: (msg: string) => console.log(`\x1b[33m${msg}\x1b[0m`),
}

// Cmd: bun patch <pkg>
// Load path to all example projects
const exampleRoots = join(import.meta.dir, "../examples")
const processWorkerRoot = join(import.meta.dir, "../")
const distPath = join(processWorkerRoot, "dist")

// Build the ProcessWorker
await $`bun run build`.cwd(processWorkerRoot)

// Test if the exampleRoots directory exists
if (!Bun.file(exampleRoots).exists()) {
  console.error(`Example projects directory not found: ${exampleRoots}`)
  process.exit(1)
}

log.yellow(`Patching example projects:`)
log.gray(`${exampleRoots}`)
const packageJsonPaths = findPackageJson(exampleRoots).map(path => {
  // remove the path up to the example project
  const relativePath = path.replace(exampleRoots, "").replace(/^\//, "")
  const folderPath = path.replace(/\/package\.json$/, "")
  const content = Bun.file(path).text()
  const nodeModuleDistPath = join(folderPath, "node_modules", "redis-process-worker", "dist")
  // Copy dist to folder:
  return {
    fullPath: path,
    relativePath,
    folderPath,
    nodeModuleDistPath,
    name: relativePath.split("/")[0], // Assuming the first part of the path is the project name
    content,
  }
})

if (packageJsonPaths.length === 0) {
  console.error("No package.json files found in example projects.")
  process.exit(1)
}
log.green(`Found ${packageJsonPaths.length} package.json files.`)

for (const pkgPath of packageJsonPaths) {
  log.gray(`Example - ${pkgPath.relativePath}`)
  log.gray(`- ${pkgPath.folderPath}`)
  const exists = Bun.file(pkgPath.nodeModuleDistPath).exists()
  if (!exists) {
    throw Error(`node_module (for ProcessWorker) not found in ${pkgPath.name}`)
  }
  await $`cp -R ${distPath} ${pkgPath.nodeModuleDistPath}`

  await $`bun patch redis-process-worker`.cwd(pkgPath.folderPath)
}

log.green(`Updated/Patched ${packageJsonPaths.length}`)
for (const pkgPath of packageJsonPaths) {
    log.yellow(`Example - ${pkgPath.name}`)
    log.gray(`- ${pkgPath.relativePath}`)
  log.gray(`- ${pkgPath.nodeModuleDistPath}`)



}