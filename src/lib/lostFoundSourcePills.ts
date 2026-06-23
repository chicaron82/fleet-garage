export const SOURCE_PILLS = [
  { label: 'Airport',  text: 'Airport return' },
  { label: 'Erin St',  text: 'Erin St'        },
  { label: 'Other',    text: null              },
] as const;

export type SourceTag = typeof SOURCE_PILLS[number]['label'];

export function appendSourceText(current: string, text: string): string {
  const base = current.trim();
  return base ? `${base} · ${text}` : text;
}

export function removeSourceText(current: string, text: string): string {
  if (current.includes(` · ${text}`)) {
    return current.replace(` · ${text}`, '').trim();
  }
  return current.replace(text, '').trim();
}
