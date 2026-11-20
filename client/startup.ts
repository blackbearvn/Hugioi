import './config/public';
import scripts from 'virtual:hu-classic-scripts';

function loadClassic(src: (typeof scripts)[number]): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = false;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.head.append(script);
  });
}

async function start(): Promise<void> {
  const config = globalThis.HU_PUBLIC_CONFIG;
  window.HU_API_BASE = import.meta.env.MODE === 'ci' ? '/api/v1' :
    config?.supabaseUrl ? `${config.supabaseUrl}/functions/v1/api` : '/api/v1';
  window.HU_AUTH_MODE = 'direct';
  // async=false giữ thứ tự thực thi dù trình duyệt tải các script song song.
  await Promise.all(scripts.map(loadClassic));
}

void start().catch(error => {
  window.HU_LOADER?.engineReady({ ready: false });
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = true;
  const notice = document.getElementById('engineNotice');
  if (notice) {
    notice.hidden = false;
    notice.textContent = 'Không tải được trò chơi. Hãy tải lại trang.';
  }
  console.error(error);
});
