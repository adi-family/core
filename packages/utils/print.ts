/**
 * Print Utility
 * Provides formatted console output helpers
 */

/**
 * Print a header with separator lines
 */
export function printHeader(text: string, width = 50): void {
  console.log('━'.repeat(width))
  console.log(text)
  console.log('━'.repeat(width))
}

/**
 * Print a section title
 */
export function printSection(title: string): void {
  console.log(`\n${title}`)
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(`✓ ${message}`)
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(`❌ ${message}`)
}

/**
 * Print a list item
 */
export function printListItem(text: string, indent = 3): void {
  console.log(`${' '.repeat(indent)}${text}`)
}

/**
 * Print a numbered list item
 */
export function printNumberedItem(number: number, text: string): void {
  console.log(`${number}. ${text}`)
}

/**
 * Print an object summary (key-value pairs)
 */
export function printSummary(
  items: Record<string, string | number | boolean>,
  indent = 3
): void {
  const spaces = ' '.repeat(indent)
  for (const [key, value] of Object.entries(items)) {
    console.log(`${spaces}${key}: ${value}`)
  }
}
