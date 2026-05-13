import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { pkg } from '@/core/package-data';

export function createOtelResource() {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: pkg.name,
    [ATTR_SERVICE_VERSION]: pkg.version,
    [ATTR_SERVICE_NAMESPACE]: 'mcp-proxy',
  });
}
