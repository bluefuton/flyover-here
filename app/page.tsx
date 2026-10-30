'use client';
import {useEffect,useRef,useState} from 'react';
import PositionMap from '../components/position-map';
import type {Aircraft} from '../lib/aircraft';
function Compass({bearing}:{bearing:number}) {return <svg viewBox="0 0 40 40" aria-hidden="true" style={{transform:`rotate(${bearing}deg)`}}><path d="M20 6l8 25-8-5-8 5z" fill="currentColor"/></svg>}
const compass=(n:number)=>['N','NE','E','SE','S','SW','W','NW'][Math.round(n/45)%8];
const aircraftNames:Record<string,string>={B789:'Boeing 787-9',B788:'Boeing 787-8',B77W:'Boeing 777-300ER',B738:'Boeing 737-800',A320:'Airbus A320',A321:'Airbus A321',A20N:'Airbus A320neo',A21N:'Airbus A321neo',A359:'Airbus A350-900',A388:'Airbus A380',AT76:'ATR 72-600',DH8D:'De Havilland Dash 8',C172:'Cessna 172'};
export default function Home(){
 const [mode,setMode]=useState<'idle'|'locating'|'live'>('idle');
 const [position,setPosition]=useState<{lat:number;lon:number}|null>(null);
 const [aircraft,setAircraft]=useState<Aircraft|null>(null);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const [radius,setRadius]=useState(25); const [metric,setMetric]=useState(true);
 const [updated,setUpdated]=useState<number|null>(null); const [now,setNow]=useState(Date.now());
 const [fullscreen,setFullscreen]=useState(false); const requestId=useRef(0);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);const f=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',f);return()=>{clearInterval(t);document.removeEventListener('fullscreenchange',f)}},[]);
 useEffect(()=>{
  const id=++requestId.current;
  if(mode!=='live'||!position) return;
  let running=false; const controller=new AbortController();
  const refresh=async()=>{if(running||document.hidden)return;running=true;setBusy(true);
   try{const r=await fetch('/api/nearest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...position,radius}),signal:controller.signal});const d=await r.json() as {error?:string;aircraft:Aircraft|null;updatedAt:number};if(id!==requestId.current)return;if(!r.ok)throw new Error(d.error||'Flight data is unavailable.');setAircraft(d.aircraft);setUpdated(d.updatedAt);setError('');}
   catch(e){if(id===requestId.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Connection interrupted. Retrying shortly.');}
   finally{running=false;if(id===requestId.current)setBusy(false);}
  };setAircraft(null);setUpdated(null);refresh();const t=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh);
  return()=>{controller.abort();clearInterval(t);document.removeEventListener('visibilitychange',refresh);if(requestId.current===id)requestId.current++};
 },[position,radius,mode]);
 const locate=()=>{requestId.current++;setBusy(false);setMode('locating');setAircraft(null);setUpdated(null);setError('');if(!navigator.geolocation){setError('Location isn’t supported in this browser. Try opening this site in Safari or Chrome.');setMode('idle');return;}
 navigator.geolocation.getCurrentPosition(p=>{setPosition({lat:p.coords.latitude,lon:p.coords.longitude});setMode('live')},e=>{setMode('idle');setError(e.code===1?'Location access is off. Allow location in your browser’s site settings, then try again.':'We couldn’t find your location. Check your device’s location settings and try again.')},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});};
 const stale=mode==='live'&&updated!==null&&now-updated>45000;
 const visible=stale?null:aircraft;
 const status=error?'Feed unavailable':busy&&!updated?'Finding aircraft':visible?'Nearest aircraft':'No aircraft nearby';
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setError('Full screen isn’t available in this browser.')}}
 const header=<header className="header"><a className="brand" href="/" aria-label="Overhead home"><span className="brand-mark">↗</span>overhead</a></header>;
 const footer=<footer><a href="https://www.adsb.lol/docs/open-data/api/" target="_blank" rel="noreferrer">Data: adsb.lol ↗</a></footer>;
 if(mode!=='live') return <main className="location-page">{header}
 <section className="location-gate" aria-labelledby="location-title">
 
 <h1 id="location-title">What’s<br/><span>overhead?</span></h1>
 <div className="gate-bottom"><p className="gate-description">Enable location to see<br/>the nearest aircraft.</p><div className="gate-action"><button className="primary" onClick={locate} disabled={mode==='locating'}>{mode==='locating'?'Locating…':'Enable location'}<span>↗</span></button><p className="gate-helper" role="status">{error || (mode==='locating'?'Allow location when your browser asks.':'')}</p></div></div>
 <details className="privacy-note"><summary>How your location is used</summary><p>Your location is sent to this site and adsb.lol for flight lookups. OpenStreetMap receives the map area you view. This app doesn’t save your location.</p></details>
 </section>{footer}</main>;
 return <main>{header}
 <section className="live-heading"><div className="section-label"><span>01</span><span>NEAREST AIRCRAFT</span></div><div className="feed-status"><span className={error||stale?'status-dot':'status-dot on'}/>{error||stale?'Connection interrupted':busy?'Updating':updated?'Live · updates every 15s':'Connecting'}</div></section>
 <section className="display" aria-label="Nearest aircraft display">
 <div className="flight-main"><div className="flight-identity"><div className="board-label">{visible?'CALLSIGN':status.toUpperCase()}</div><h1 className="callsign">{visible?.callsign||'—'}</h1><div className="aircraft-model">{visible?(aircraftNames[visible.type||'']||visible.type||'Unknown aircraft type'):busy?'Checking your local airspace…':`Searching within ${radius} km`}{visible?.registration&&<span className="registration">{visible.registration}</span>}</div>{visible&&<a className="flight-link" href={visible.registration?`https://www.flightradar24.com/data/aircraft/${encodeURIComponent(visible.registration.toLowerCase())}`:`https://www.flightradar24.com/${visible.latitude.toFixed(2)},${visible.longitude.toFixed(2)}/12`} target="_blank" rel="noreferrer">View on Flightradar24 ↗</a>}</div><div className="distance"><span className="board-label">DISTANCE FROM YOU</span><div><span className="distance-number">{visible?(visible.distance*(metric?1:0.621371)).toFixed(1):'—'}</span><span className="distance-unit">{metric?'km':'mi'}</span></div>{visible&&<span className="direction"><Compass bearing={visible.bearing}/>{compass(visible.bearing)} of you</span>}</div></div>
 <div className="metrics"><div><span className="board-label">ALTITUDE</span><strong>{visible?Math.round(visible.altitude/(metric?3.28084:1)).toLocaleString():'—'}<small>{metric?'m':'ft'}</small></strong></div><div><span className="board-label">GROUND SPEED</span><strong>{visible?.speed!=null?Math.round(visible.speed*(metric?1.852:1.15078)).toLocaleString():'—'}<small>{metric?'km/h':'mph'}</small></strong></div><div><span className="board-label">HEADING</span><strong>{visible?.track!=null?Math.round(visible.track)+'°':'—'}<small>{visible?.track!=null?compass(visible.track):''}</small></strong></div><div><span className="board-label">VERTICAL RATE</span><strong>{visible?.verticalRate!=null?(Math.abs(visible.verticalRate)<100?'Level':(visible.verticalRate>0?'+':'−')+Math.abs(Math.round(visible.verticalRate)).toLocaleString()):'—'}<small>{visible?.verticalRate!=null&&Math.abs(visible.verticalRate)>=100?'ft/min':''}</small></strong></div></div>
 <div className="updated" aria-live="polite">{error|| (stale?'Positions are out of date. Reconnecting…':updated?`Updated ${Math.max(0,Math.floor((now-updated)/1000))}s ago`:busy?'Retrieving live positions…':'Waiting for aircraft data.')}</div>
 </section>
 {position&&<PositionMap position={position} aircraft={visible}/> }
 <div className="settings"><div className="settings-left"><label htmlFor="radius">RANGE</label><select id="radius" aria-label="Search radius" value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={5}>5 km</option><option value={10}>10 km</option><option value={25}>25 km</option><option value={50}>50 km</option></select><div className="unit-toggle" aria-label="Display units"><button aria-pressed={metric} onClick={()=>setMetric(true)}>Metric</button><button aria-pressed={!metric} onClick={()=>setMetric(false)}>Imperial</button></div></div><div className="settings-right"><button className="text-button" onClick={locate}>Relocate ↗</button><button className="text-button" onClick={toggleFullscreen}>{fullscreen?'Exit full screen':'Full screen'} ⛶</button></div></div>
 <details className="data-note"><summary>About this flight data <span>+</span></summary><p>We select the airborne aircraft with the shortest ground distance from you. Nearby doesn’t always mean directly overhead. Reports older than 30 seconds and grounded aircraft are excluded. Coverage varies. Altitude is barometric, not height above your location. Data from <a href="https://www.adsb.lol/docs/open-data/api/" target="_blank" rel="noreferrer">adsb.lol</a>, licensed under <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>. For curiosity, not navigation.</p></details>{footer}
 </main>;
}
