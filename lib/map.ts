import type {Aircraft} from './aircraft';
export function project(lat:number,lon:number){const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));const s=Math.sin(clamped*Math.PI/180);return {x:(lon+180)/360,y:0.5-Math.log((1+s)/(1-s))/(4*Math.PI)};}
export function mapLayout(position:{lat:number;lon:number},aircraft:Aircraft|null,width:number,height:number){
 const user=project(position.lat,position.lon); const point=aircraft?project(aircraft.latitude,aircraft.longitude):user;
 let dx=point.x-user.x; if(dx>.5)dx-=1;if(dx<-.5)dx+=1;
 const target={x:user.x+dx,y:point.y};
 const z=aircraft?Math.max(2,Math.min(14,Math.floor(Math.log2(Math.min(Math.max(1,width-120)/(256*Math.max(Math.abs(dx),.00001)),Math.max(1,height-110)/(256*Math.max(Math.abs(target.y-user.y),.00001))))))):12;
 const world=256*2**z;const left=(user.x+target.x)/2*world-width/2;const top=(user.y+target.y)/2*world-height/2;
 return {z,left,top,user:{x:user.x*world-left,y:user.y*world-top},plane:{x:target.x*world-left,y:target.y*world-top}};
}
