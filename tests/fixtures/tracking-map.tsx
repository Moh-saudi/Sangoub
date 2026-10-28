import {useState} from 'react';import {createRoot} from 'react-dom/client';import {TrackingMap} from '../../src/components/TrackingMap';
function Fixture(){const [point,setPoint]=useState({latitude:30.01,longitude:31.7});(window as any).moveTrackingPoint=()=>setPoint({latitude:30.011,longitude:31.701});return <TrackingMap mapKey="synthetic-fixture" point={point} destination={{latitude:30.02,longitude:31.72}} route={{distanceMeters:3000,durationSeconds:300,polyline:[[30.01,31.7],[30.02,31.72]],isFallback:false,calculatedAt:0}}/>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
