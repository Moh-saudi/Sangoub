import {useEffect,useRef,useState} from 'react';
import {RoutePlanner,remainingRoute,type Coordinates,type RouteResult} from './osmRouting';
export function useOsmRoute(point?:Coordinates|null,destination?:Coordinates|null,journeyKey?:string){
 const planner=useRef(new RoutePlanner()),[route,setRoute]=useState<RouteResult|null>(null);
 const controller=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort()}},[]);
 useEffect(()=>{planner.current=new RoutePlanner();setRoute(null);controller.current?.abort();controller.current=new AbortController();},[journeyKey,destination?.latitude,destination?.longitude]);
 useEffect(()=>{if(!point||!destination)return;const signal=controller.current?.signal;const current=planner.current;void current.update(point,destination,{signal}).then(value=>{if(mounted.current&&planner.current===current&&!signal?.aborted)setRoute(value)});},[journeyKey,point?.latitude,point?.longitude,destination?.latitude,destination?.longitude]);
 return {route,remaining:route&&point?remainingRoute(route,point):null};
}
