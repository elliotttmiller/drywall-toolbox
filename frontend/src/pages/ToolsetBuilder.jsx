import LegacyToolsetBuilder from './LegacyToolsetBuilder.jsx';
import ToolsetBuilderPlatform from './ToolsetBuilderPlatform.jsx';
import { isCatalogPlatformEnabled } from '../utils/featureFlags.js';

export default function ToolsetBuilder() {
  return isCatalogPlatformEnabled() ? <ToolsetBuilderPlatform /> : <LegacyToolsetBuilder />;
}
