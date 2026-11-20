export interface HuPublicConfig {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly hcaptchaSitekey: string;
}

declare global {
  var HU_PUBLIC_CONFIG: HuPublicConfig | undefined;

  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly VITE_HCAPTCHA_SITEKEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

globalThis.HU_PUBLIC_CONFIG = Object.freeze({
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, ''),
  supabasePublishableKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim(),
  hcaptchaSitekey: (import.meta.env.VITE_HCAPTCHA_SITEKEY ?? '').trim(),
});
