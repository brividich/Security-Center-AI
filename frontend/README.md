# Security Center AI Frontend

Vite + React + TypeScript frontend for the Security Center AI console.

```bash
npm install
npm run dev
npm run build
```

The dashboard service reads compact Django endpoints from `VITE_API_BASE_URL`, which defaults to `http://127.0.0.1:8000`. Mock data remains in `src/data/mockData.ts` as the offline fallback when the backend is unavailable.
