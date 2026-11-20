declare module 'virtual:hu-classic-scripts' {
  const scripts: readonly `/${string}.js`[];
  export default scripts;
}

interface Window {
  HU_API_BASE: string;
  HU_AUTH_MODE: 'direct';
  HU_LOADER?: { engineReady(state: { ready: boolean }): void };
}

interface ImportMetaEnv {
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
