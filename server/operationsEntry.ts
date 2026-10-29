import { serverEntry } from './serverEntry.js';

// Both public URLs share one Vercel function; each keeps its existing handler.
export function createOperationsEntry(
  loadOperations = () => import('./handlers/operations.ts'),
  loadOsm = () => import('./handlers/osm.ts'),
) {
  const operations = serverEntry(loadOperations);
  const osm = serverEntry(loadOsm);
  return (req: any, res: any) => {
    const action = req.params?.action ?? req.query?.osmAction;
    if (action !== undefined) {
      req.query = { ...req.query, action };
      return osm(req, res);
    }
    return operations(req, res);
  };
}
