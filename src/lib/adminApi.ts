import { authenticatedApi } from './authenticatedApi';
export function adminApi(endpoint:'users'|'data',body:object){return authenticatedApi('/api/admin-'+endpoint,body);}
