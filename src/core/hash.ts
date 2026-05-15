import { createHash as nodeCreateHash } from 'node:crypto';

export const createHash = (input: string): string => {
  return nodeCreateHash('sha256').update(input).digest('hex');
};
