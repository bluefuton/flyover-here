import {nearestAircraft} from '../../../lib/aircraft';
export async function POST(request: Request) {
 try {
  const {lat,lon,radius} = await request.json() as {lat:number;lon:number;radius:number};
  if (!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||![5,10,25,50].includes(radius)) return Response.json({error:'Invalid location or range.'},{status:400});
  const response=await fetch(`https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${Math.ceil(radius/1.852)}`,{signal:AbortSignal.timeout(12000),headers:{'Accept':'application/json'}});
  if(!response.ok) return Response.json({error:'The flight data service is unavailable. We’ll try again shortly.'},{status:503});
  const data=await response.json() as {ac?:unknown};
  if(!Array.isArray(data.ac)) throw new Error('Invalid feed');
  return Response.json({aircraft:nearestAircraft(data.ac,lat,lon,radius),updatedAt:Date.now(),source:'adsb.lol'},{headers:{'Cache-Control':'no-store'}});
 } catch { return Response.json({error:'Unable to reach live flight data. We’ll try again shortly.'},{status:503}); }
}
