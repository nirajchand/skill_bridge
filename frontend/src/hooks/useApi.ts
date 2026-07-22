'use client';

export default function useApi(url: string, method: string) {
  return {
    data: null,
    loading: false,
    error: null,
    execute: async () => undefined
  };
}
