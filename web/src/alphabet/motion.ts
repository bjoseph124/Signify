/** Experimental J/Z trajectory checks. No calibrated confidence; not release validated. */
import { distance, type Point } from '../classifier';
export type MotionLetter = 'J'|'Z';
type Sample = { t:number; x:number; y:number };
function joint(a:Point,b:Point,c:Point) {
  const d=distance(a,b)*distance(c,b);
  return d<1e-8?0:Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+(v-b[i])*(c[i]-b[i]),0)/d)))*180/Math.PI;
}
export function motionHandshape(p:Point[]): MotionLetter|null {
  if(p.length!==21||p.some(q=>q.length!==3||q.some(v=>!Number.isFinite(v))))return null;
  const scale=distance(p[0],p[9]);if(scale<1e-6)return null;
  const up=(b:number)=>joint(p[b],p[b+1],p[b+2])>155&&joint(p[b+1],p[b+2],p[b+3])>150&&distance(p[b+3],p[0])>distance(p[b+1],p[0])+.2*scale;
  const down=(b:number)=>joint(p[b],p[b+1],p[b+2])<135&&distance(p[b+3],p[b])<.8*scale;
  const tucked=distance(p[4],p[9])<.75*scale;
  if(tucked&&down(5)&&down(9)&&down(13)&&up(17))return 'J';
  if(tucked&&up(5)&&down(9)&&down(13)&&down(17))return 'Z';
  return null;
}

/** Path coordinates in initial palm lengths. J x is toward thumb; Z allows mirrored hands.
 * Segment order and endpoint settling matter; a single pose never returns a letter.
 */
export function matchTrajectory(samples:Sample[], kind:MotionLetter):boolean {
  if(samples.length<10)return false;
  const duration=samples.at(-1)!.t-samples[0].t;
  if(duration<400||duration>2400)return false;
  const a=samples[0],d=samples.at(-1)!;
  // Require the last 120ms to be relatively still so partial strokes do not commit.
  const tail=samples.filter(p=>p.t>=d.t-120);
  if(tail.length<3||tail.some(p=>Math.hypot(p.x-d.x,p.y-d.y)>.14))return false;
  const length=samples.slice(1).reduce((v,p,i)=>v+Math.hypot(p.x-samples[i].x,p.y-samples[i].y),0);
  if(length<1||length>5)return false;
  if(kind==='J') {
    let turn=0;for(let i=1;i<samples.length;i++)if(samples[i].y>samples[turn].y)turn=i;
    const b=samples[turn];
    return turn>=3 && turn<samples.length-3 && b.y-a.y>.65 && Math.abs(b.x-a.x)<.5
      && d.x-b.x>.3 && b.y-d.y>.2 && b.y-d.y<1 && d.y-a.y>.1
      && samples.slice(0,turn+1).every((p,i,arr)=>i===0||p.y>=arr[i-1].y-.12);
  }
  // Three strokes: across, diagonally back/down, across in the first direction.
  for(let i=3;i<samples.length-6;i++)for(let j=i+3;j<samples.length-3;j++){
    const b=samples[i],c=samples[j],dx=b.x-a.x,sign=Math.sign(dx);
    if(Math.abs(dx)<.55||Math.abs(b.y-a.y)>.22||sign*(c.x-b.x)>-.45||c.y-b.y<.4
      ||sign*(d.x-c.x)<.5||Math.abs(d.y-c.y)>.22)continue;
    const straight=(from:number,to:number)=>{
      const start=samples[from],end=samples[to],vx=end.x-start.x,vy=end.y-start.y,den=Math.hypot(vx,vy);
      return samples.slice(from,to+1).every(p=>Math.abs(vx*(p.y-start.y)-vy*(p.x-start.x))/den<.18);
    };
    if(straight(0,i)&&straight(i,j)&&straight(j,samples.length-1))return true;
  }
  return false;
}

export class MotionRecognizer {
  private samples:Sample[]=[];
  private kind:MotionLetter|null=null;
  private origin:Point|null=null;
  private scale=1;
  private thumbDirection=1;
  private previousWrist:Point|null=null;
  private lastTime=-Infinity;
  private hand='';
  private cooldown=-Infinity;
  reset(){this.samples=[];this.kind=null;this.origin=null;this.previousWrist=null;this.lastTime=-Infinity;this.hand='';this.cooldown=-Infinity;}
  update(points:Point[]|null,t:number,hand:string):MotionLetter|null {
    if(!Number.isFinite(t)||!points){this.reset();return null;}
    const kind=motionHandshape(points);
    if(!kind){this.reset();return null;}
    if(t<=this.lastTime||t-this.lastTime>250||hand!==this.hand||kind!==this.kind
      ||(this.previousWrist&&distance(points[0],this.previousWrist)>this.scale*.8))this.reset();
    if(!this.origin){this.origin=[...points[kind==='J'?20:8]];this.scale=distance(points[0],points[9]);this.thumbDirection=Math.sign(points[5][0]-points[17][0])||1;}
    this.kind=kind;this.hand=hand;this.lastTime=t;this.previousWrist=points[0];
    if(t<this.cooldown)return null;
    const tip=points[kind==='J'?20:8];
    this.samples.push({t,x:(tip[0]-this.origin[0])/this.scale*(kind==='J'?this.thumbDirection:1),y:(tip[1]-this.origin[1])/this.scale});
    if(this.samples.length>90||t-this.samples[0].t>2400){this.samples=[];this.origin=null;return null;}
    if(matchTrajectory(this.samples,kind)){this.samples=[];this.origin=null;this.cooldown=t+700;return kind;}
    return null;
  }
}
