export interface Appearance { accent: string; background: string; surface: string; text: string; writing: string; sidebar: string; }
export const DEFAULT_APPEARANCE: Appearance = { accent: "", background: "", surface: "", text: "", writing: "", sidebar: "" };
export function normalizeAppearance(value: unknown): Appearance {
 const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
 return Object.fromEntries(Object.keys(DEFAULT_APPEARANCE).map(key => [key, typeof source[key] === "string" && /^#[0-9a-f]{6}$/i.test(source[key] as string) ? source[key] : ""])) as unknown as Appearance;
}
export function mixColor(hex: string, target: string, amount: number): string {
 return "#" + [0,2,4].map(i => Math.round(parseInt(hex.slice(i+1,i+3),16)*(1-amount)+parseInt(target.slice(i+1,i+3),16)*amount).toString(16).padStart(2,"0")).join("");
}
export function contrastColor(hex: string): string {
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722>0.179 ? "#111827" : "#ffffff";
}
