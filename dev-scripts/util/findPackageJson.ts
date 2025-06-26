import { readdirSync, statSync } from "fs";
import { join } from "path/posix";

// Find all example projects
export function findPackageJson(dir: string): string[] {
    function isIgnored(folder: string): boolean {
        return folder.startsWith(".") || folder.includes("node_modules");
    }
    const results: string[] = [];
    let entries: string[] = [];
    try {
        entries = readdirSync(dir);
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        if (isIgnored(entry)) continue;
        let stat;
        try {
            stat = statSync(fullPath);
        } catch {
            continue;
        }
        if (stat.isFile() && entry === "package.json") {
            results.push(fullPath);
        } else if (stat.isDirectory()) {
            results.push(...findPackageJson(fullPath));
        }
    }
    return results;
}
;
