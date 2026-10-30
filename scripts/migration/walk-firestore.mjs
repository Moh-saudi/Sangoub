// Offline administrative traversal. listDocuments also includes missing parents
// with live subcollections. getAll is chunked to bound document payload memory.
export async function walkFirestore(db, onDocument) {
 async function visit(collection){
  const refs=await collection.listDocuments();
  for(let offset=0;offset<refs.length;offset+=100){
   const snapshots=await db.getAll(...refs.slice(offset,offset+100));
   for(const snapshot of snapshots){
    if(snapshot.exists)await onDocument(snapshot);
    for(const child of await snapshot.ref.listCollections())await visit(child);
   }
  }
 }
 for(const collection of await db.listCollections())await visit(collection);
}
