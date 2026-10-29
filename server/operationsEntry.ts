import { serverEntry } from './serverEntry.js';

// Both public URLs share one Vercel function; each keeps its existing handler.
export function createOperationsEntry(
  loadOperations = () => import('./handlers/operations.ts'),
  loadOsm = () => import('./handlers/osm.ts'),
) {
  const operations = serverEntry(loadOperations);
  const osm = serverEntry(loadOsm);
  const publicSearch = serverEntry(loadOsm, { requireAuth: false });
  return (req: any, res: any) => {
    const action = req.params?.action ?? req.query?.osmAction;
    if (action !== undefined) {
      req.query = { ...req.query, action };
      return action === 'search' ? publicSearch(req, res) : osm(req, res);
    }
    return operations(req, res);
  };
}
