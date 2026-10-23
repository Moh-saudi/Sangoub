import express from 'express';
import {createServer} from 'vite';
import users from '../api/admin-users.ts';
import data from '../api/admin-data.ts';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FIREBASE_PROJECT_ID!=='demo-capital-talabat')throw new Error('Local demo emulators required');
const app=express();app.use(express.json({limit:'1mb'}));app.post('/api/admin-users',users);app.post('/api/admin-data',data);
const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);app.listen(3105,'127.0.0.1');
