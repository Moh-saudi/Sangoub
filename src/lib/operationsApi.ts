import { authenticatedApi } from './authenticatedApi';
export function operationsApi(endpoint:'operations'|'app-content',body:object){return authenticatedApi('/api/'+endpoint,body);}
