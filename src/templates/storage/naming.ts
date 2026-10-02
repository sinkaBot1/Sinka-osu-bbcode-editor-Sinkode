export const NEW_TEMPLATE_NAME = '未命名模板'

export function uniqueName(base: string, existingNames: Iterable<string>): string {
  const taken = new Set(existingNames)
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base} (${index})`)) index += 1
  return `${base} (${index})`
}

export function duplicateTemplateName(sourceName: string): string {
  return `${sourceName} - 副本`
}
