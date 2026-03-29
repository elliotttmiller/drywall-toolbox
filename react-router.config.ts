import type {Config} from '@react-router/dev/config';

export default {
  appDirectory: 'app',
  // Oxygen deploys to Cloudflare Workers; server-side rendering is required.
  ssr: true,
} satisfies Config;
