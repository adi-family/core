/**
 * File System Utilities
 * Shared utilities for file and directory operations
 */

import { readdir } from 'fs/promises'
import { join, relative } from 'path'

/**
 * Recursively get all files in a directory
 *
 * @param dirPath - The directory to search
 * @param baseDir - The base directory for relative path calculation (defaults to dirPath)
 * @returns Array of relative file paths from baseDir
 */
export async function getAllFiles(dirPath: string, baseDir: string = dirPath): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []
  const ignoredTemplateDirs = ['node_modules', '.git', 'dist', 'build', 'result', 'results']

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (ignoredTemplateDirs.includes(entry.name)) continue;
      const subFiles = await getAllFiles(fullPath, baseDir)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      files.push(relative(baseDir, fullPath))
    }
  }

  return files
}
