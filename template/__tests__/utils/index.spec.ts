import { describe, test, expect } from 'vitest';
import { stringifyQuery } from '@/utils';

describe('utils', () => {
  test('stringifyQuery', () => {
    expect(stringifyQuery({ page: '1', size: '10', status: 'a,b' })).toBe(
      '?page=1&size=10&status=a%2Cb',
    );
  });
});
