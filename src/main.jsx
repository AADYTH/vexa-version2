import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import emailjs from '@emailjs/browser';
import './styles.css';

/* ---------- About page copy ----------
   Condensed to fit one still screen, no scroll: the two duality lines
   stay close to your original wording, the three short closing sentences
   are joined into one line (same meaning, reads as a single beat instead
   of a stack of paragraphs). */
const ABOUT_COPY={
  eyebrow:'ABOUT VEXA',
  title:'One being. Two sides.',
  lede:'Our lowest and our highest — both part of the same being.',
  black:'The black is loneliness, doubt, fear — everything that brings us down.',
  white:'The white is hope, growth, connection — every moment we rise.',
  closing:'They are not two different beings. They are one — and no matter where we are, we are never truly alone.',
  tagline:'VEXA — you are never alone.'
};

/* ---------- Powers page copy ---------- */
const POWER_SIDES=[
  {swatch:'black',label:'BLACK — The Depth',short:'Awareness of what we feel but don\'t always express.'},
  {swatch:'white',label:'WHITE — The Light',short:'Imagination, hope, ideas — the will to move forward.'}
];
const POWER_PRINCIPLES=[
  {name:'THE BALANCE',short:'Both moments are part of who we are.'},
  {name:'THE CONNECTION',short:'Whatever state you\'re in, you are never alone.'}
];
const POWER_CARDS=[
  {tag:'01',name:'Echo',desc:'VEXA understands what you express.'},
  {tag:'02',name:'Vision',desc:'Turn thoughts into possibilities.'},
  {tag:'03',name:'Memory',desc:'Hold on to what matters.'},
  {tag:'04',name:'Connect',desc:'A presence when you need one.'},
  {tag:'05',name:'Adapt',desc:'VEXA evolves with you.'},
  {tag:'06',name:'Balance',desc:'The power of both sides becoming one.'}
];

/* ---------- Mission page copy - three sentences joined into one line ---------- */
const MISSION_COPY={
  eyebrow:'OUR MISSION',
  title:'Make technology feel more human.',
  body:'A space where technology and human experience meet — to explore, create, express, and connect through every version of ourselves, at our lowest and our highest.',
  words:['Explore','Create','Connect'],
  tagline:'One being. Every side. Never alone.'
};

/* ---------- automatic notification email ----------
   Sent the moment a visitor finishes describing their grievance, via
   EmailJS (client-side, no backend required). Configure the three
   VITE_EMAILJS_* values and VITE_HERO_EMAIL in .env - see .env.example.
   If unconfigured, this fails quietly and the app keeps working; the
   grievance is still saved to localStorage as a fallback. */
async function sendHelpRequestEmail(info){
  const serviceId=import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId=import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const toEmail=import.meta.env.VITE_HERO_EMAIL;
  if(!serviceId||!templateId||!publicKey||!toEmail){
    console.warn('[VEXA] Email notification skipped: EmailJS is not configured. See .env.example.');
    return false;
  }
  const submittedAt=new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
  try{
    await emailjs.send(serviceId,templateId,{
      to_email:toEmail,
      visitor_name:info.name,
      visitor_age:info.age,
      visitor_location:info.location,
      visitor_email:info.email,
      grievance:info.grievance,
      submitted_at:submittedAt,
      subject:'Someone Needs Your Help!'
    },{publicKey});
    return true;
  }catch(err){
    console.error('[VEXA] Failed to send help-request email:',err);
    return false;
  }
}

/* ---------- the small, in-scene hero loop on the home page ----------
   Real-time chroma-keyed footage of VEXA standing inside the home page's
   portal ring - cape-in-breeze for the light form, a quieter idle loop
   for the dark form. Rendered small and set to `pointer-events:none` so
   it reads as ambient life in the scene rather than another button. */
const HERO_LOOP={
  light:'/video/pages/hero-light-loop.mp4',
  dark:'/video/pages/hero-dark-loop.mp4'
};
/* phones process the chroma-key loop at a lower internal resolution than
   tablets/desktops - the canvas is displayed just as small either way on
   a phone screen, so there's nothing gained by keying more pixels than
   the display can ever show, only battery/CPU spent on it. Checked once
   per render (a matchMedia call is effectively free) rather than cached,
   so it stays correct across rotation/resize without any extra listener. */
const smallScreenCap=()=>{
  try{return matchMedia('(max-width:700px)').matches?100:140}catch{return 140}
};

/* ---------- VEXA's voice: real LLM chat via OpenRouter, proxied through
   a tiny serverless function (api/chat.js) so the API key stays server-
   side and is never exposed in the client bundle. Persona shifts with the
   theme - warm/celebratory in light mode, grounded/comforting in dark
   mode. Streams tokens in as they arrive rather than waiting for a full
   response. Falls back gracefully (see `send()` in App) if the proxy call
   fails for any reason, so the app still works even without a key
   configured. ----------
   Setup: in your deployment's environment variables (e.g. Vercel project
   → Settings → Environment Variables, NOT a VITE_ prefixed var - this is
   read server-side only, inside api/chat.js), set:
     OPENROUTER_API_KEY=your_key_here
   Get a free key at https://openrouter.ai/keys */
const OPENROUTER_MODEL='nex-agi/nex-n2.5-pro:free';
async function askVexaStream(history,dark,onToken){
  const persona=dark
    ?"You are VEXA - right now in your dark, comforting form. Someone has come to you at a low point. Be a calm, steady presence: gentle, grounding, quietly motivating, never clinical or preachy. Validate what they feel before offering any perspective. Keep replies short and warm, 2-4 sentences. If they describe real crisis, self-harm, or being in danger, gently encourage them to reach out to a trusted person or a crisis line, without being alarming."
    :"You are VEXA - right now in your light, radiant form. Be genuinely warm, encouraging and celebratory, like a close friend who is delighted for this person. Keep replies short, 2-4 sentences, upbeat but never over-the-top or clinical.";
  const res=await fetch('/api/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:OPENROUTER_MODEL,stream:true,temperature:.85,max_tokens:220,
      messages:[{role:'system',content:persona},...history]})
  });
  if(!res.ok||!res.body){
    const errText=await res.text().catch(()=>'');
    console.error('[VEXA] OpenRouter HTTP ERROR:',res.status,errText);
    throw new Error('openrouter-http-'+res.status);
  }
  const reader=res.body.getReader(),decoder=new TextDecoder();
  let buf='',gotText=false;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    buf+=decoder.decode(value,{stream:true});
    const lines=buf.split('\n');buf=lines.pop()||'';
    for(const line of lines){
      const t=line.trim();if(!t||t.startsWith(':')||!t.startsWith('data:'))continue;
      const data=t.slice(5).trim();if(!data||data==='[DONE]')continue;
      try{const token=JSON.parse(data).choices?.[0]?.delta?.content;if(token){gotText=true;onToken(token)}}
      catch{console.warn('[VEXA] Failed to parse stream chunk:',data)}
    }
  }
  const finalLine=buf.trim();
  if(finalLine.startsWith('data:')){
    const data=finalLine.slice(5).trim();
    if(data&&data!=='[DONE]'){
      try{const token=JSON.parse(data).choices?.[0]?.delta?.content;if(token){gotText=true;onToken(token)}}
      catch{console.warn('[VEXA] Failed to parse final stream chunk:',data)}
    }
  }
  if(!gotText){console.error('[VEXA] Stream finished without text.');throw new Error('empty-stream')}
}

/* ---------- realtime chroma-key video -> transparent canvas ----------
   Optimized to only do the (expensive) per-pixel keying work once per
   actual decoded video frame - via requestVideoFrameCallback where
   available, falling back to a currentTime-dedup on requestAnimationFrame -
   instead of redoing it 60x/sec regardless of the source's real frame rate.
   Processing also happens at a capped internal resolution to keep the
   per-frame pixel loop cheap on lower-powered devices. */
/* `hidden` marks an instance that's decoding/keying but not actually the
   one on screen right now (e.g. the home hero's off-theme clip, kept
   playing so the crossfade has something current to blend into). Both
   hero clips otherwise run this same expensive per-pixel loop at once,
   which is real, measurable main-thread cost for a layer nobody can see -
   so a hidden instance only re-keys every other decoded frame instead of
   every one. It's invisible until the moment a crossfade actually starts,
   and a ~950ms crossfade never has time to show a frame stale enough to
   notice, so this halves its cost for free. */
function ChromaVideo({src,className,rate=1,loop=true,onReady,onEnded,active=true,capWidth=240,hidden=false}){
  const videoRef=useRef(null),canvasRef=useRef(null),rafRef=useRef(null),readyFired=useRef(false),lastT=useRef(-1),skip=useRef(false);
  // read through a ref inside the effect below rather than closing over the
  // `hidden` prop directly - `hidden` flips every theme toggle, and this
  // must NOT be a dependency of that effect: restarting it would reset
  // `currentTime` to 0 and replay both hero clips from the start on every
  // toggle, breaking the always-playing continuity the crossfade depends on.
  const hiddenRef=useRef(hidden); hiddenRef.current=hidden;
  useEffect(()=>{
    readyFired.current=false;lastT.current=-1;skip.current=false;
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas)return;
    const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:true});
    video.muted=true;video.playsInline=true;video.loop=loop;video.playbackRate=rate;
    // capped lower than before (was 360) - this is the expensive per-frame
    // pixel loop below, so halving the pixel count here roughly halves the
    // main-thread cost of every single keyed frame, on every ChromaVideo
    // instance running at once. 240px is still plenty sharp once scaled
    // back up by CSS for a figure that only occupies part of the frame.
    let w=180,h=320,scale=1;
    const size=()=>{
      const vw=video.videoWidth||360,vh=video.videoHeight||640;
      scale=vw>capWidth?capWidth/vw:1; // cap internal processing width
      w=Math.round(vw*scale);h=Math.round(vh*scale);
      canvas.width=w;canvas.height=h;
    };
    const key=()=>{
      ctx.drawImage(video,0,0,w,h);
      try{
        const frame=ctx.getImageData(0,0,w,h),d=frame.data;
        for(let i=0;i<d.length;i+=4){
          const r=d[i],g=d[i+1],b=d[i+2];
          const green=g-(r>b?r:b);
          if(green>55)d[i+3]=0;
          else if(green>12)d[i+3]=255-Math.round(255*(green-12)/43);
          if(g>(r+b)>>1)d[i+1]=((r+b)>>1)+((g-((r+b)>>1))>>2);
        }
        ctx.putImageData(frame,0,0);
      }catch(e){}
      if(!readyFired.current){readyFired.current=true;onReady&&onReady()}
    };
    // requestVideoFrameCallback path: fires exactly once per decoded frame
    let useRVFC=typeof video.requestVideoFrameCallback==='function';
    const maybeKey=()=>{
      if(!hiddenRef.current){key();return}
      // hidden instance: only do the actual pixel-processing work on every
      // other decoded frame - still marks itself ready on the very first
      // frame either way, so a crossfade starting early never waits on it.
      skip.current=!skip.current;
      if(skip.current)key();
    };
    const vfcTick=()=>{
      if(video.readyState>=2)maybeKey();
      if(active)video.requestVideoFrameCallback(vfcTick);
    };
    // rAF fallback: skip re-keying if the video hasn't advanced
    const rafTick=()=>{
      if(video.readyState>=2&&video.currentTime!==lastT.current){lastT.current=video.currentTime;maybeKey()}
      rafRef.current=requestAnimationFrame(rafTick);
    };
    // only autoplay/reset when this instance is actually the one that should
    // be running - previously this fired regardless of `active`, so an
    // "inactive" ChromaVideo (e.g. the hero-loop hidden behind the
    // transformation overlay) kept decoding and restarting in the
    // background for no visible reason, competing for the same main
    // thread as the transition's own chroma-key loop.
    const onLoaded=()=>{
      size();
      if(active){video.currentTime=0;const p=video.play();if(p?.catch)p.catch(()=>{})}
    };
    video.addEventListener('loadedmetadata',onLoaded);
    if(video.readyState>=1)onLoaded();
    if(onEnded)video.addEventListener('ended',onEnded);
    if(active){
      if(useRVFC)video.requestVideoFrameCallback(vfcTick);
      else rafRef.current=requestAnimationFrame(rafTick);
    }else{
      video.pause();
    }
    return()=>{cancelAnimationFrame(rafRef.current);video.removeEventListener('loadedmetadata',onLoaded);if(onEnded)video.removeEventListener('ended',onEnded);video.pause()}
  },[src,rate,loop,active,capWidth]);
  return <>
    <video ref={videoRef} src={active?src:undefined} style={{display:'none'}} preload={active?'auto':'none'} muted playsInline/>
    <canvas ref={canvasRef} className={className}/>
  </>;
}

/* ---------- scroll-reveal ---------- */
function useReveal(){
  useEffect(()=>{
    const els=document.querySelectorAll('.reveal');
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})
    },{threshold:.18});
    els.forEach(el=>io.observe(el));
    return()=>io.disconnect();
  },[]);
}

/* ---------- swoosh zoom-in: each palace stage punches in with a fast
   scale+blur settle as it enters the viewport, retriggering each time you
   scroll past it (either direction) - this reads as a cut/zoom between
   distinct pages rather than a continuous scroll-tied drift. */
function useSwoosh(){
  useEffect(()=>{
    const els=document.querySelectorAll('.swoosh');
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>en.target.classList.toggle('go',en.isIntersecting))
    },{threshold:.35});
    els.forEach(el=>io.observe(el));
    return()=>io.disconnect();
  },[]);
}

/* ---------- small standing character, centered in the scene ---------- */
function Standing({src}){
  return <div className="standing"><img src={src}/></div>;
}

/* ---------- cursor-reveal hover, scoped to a single portrait: the opposite
   theme's image is only visible in a soft circle following the cursor,
   confined to this element's own bounds. ---------- */
function HoverReveal({base,reveal,className}){
  const ref=useRef(null);
  const move=e=>{
    const el=ref.current;if(!el)return;
    const r=el.getBoundingClientRect();
    el.style.setProperty('--hx',((e.clientX-r.left)/r.width*100)+'%');
    el.style.setProperty('--hy',((e.clientY-r.top)/r.height*100)+'%');
    el.classList.add('hovering');
  };
  const leave=()=>ref.current?.classList.remove('hovering');
  return <div ref={ref} className={'hover-reveal '+(className||'')} onPointerMove={move} onPointerLeave={leave}>
   <img className="hr-base" src={base}/>
   <img className="hr-reveal" src={reveal}/>
  </div>;
}

/* ---------- drifting fog, for the sanctum hallway ---------- */
function Fog(){
  return <div className="fog">{Array.from({length:6},(_,i)=><span key={i} style={{'--i':i}}/>)}</div>;
}

/* ---------- ambient particle field ----------
   A single full-screen canvas: a handful of soft drifting motes that
   gently avoid the cursor. White specks on the dark theme, ink-dark
   specks on the light theme, so it always reads against the background
   rather than blending into it.
   Perf: one `requestAnimationFrame` loop total (not one per particle),
   a fixed small particle count, no shadows/blur - just plain filled
   circles with per-particle alpha for softness - and the loop pauses
   itself entirely whenever the tab is hidden or `active` is false, so
   it only ever runs while the chat page is actually on screen. */
function ParticleField({dark,active=true,count=70}){
  const canvasRef=useRef(null);
  useEffect(()=>{
    if(!active)return;
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');
    // `ready` gates the very first paint: the canvas can mount a frame or
    // two before it actually has a laid-out size (e.g. right as the page
    // transition hands off), and w/h would read 0 in that window - drawing
    // then collapses every particle onto (0,0), which is what read as
    // "everything starts bunched in one corner". Skipping paint entirely
    // until a real, non-zero size is known means the very first frame
    // anyone sees already has all particles spread across their real
    // (already-uniformly-random) positions, instead of animating out from
    // a corner.
    let w=0,h=0,dpr=Math.min(devicePixelRatio||1,2),raf=0,mx=-9999,my=-9999,live=true,ready=false;
    const parts=Array.from({length:count},()=>({
      x:Math.random(),y:Math.random(),
      r:1.1+Math.random()*2.2,
      vx:(Math.random()-.5)*.00018,vy:(Math.random()-.5)*.00018,
      a:.4+Math.random()*.5,drift:Math.random()*Math.PI*2
    }));
    const resize=()=>{
      const nw=canvas.clientWidth,nh=canvas.clientHeight;
      if(!nw||!nh)return; // layout not settled yet - try again next tick/observer callback
      w=nw;h=nh;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ready=true;
    };
    resize();
    // ResizeObserver catches the canvas's first real size the moment layout
    // settles (right after mount, on rotation, on virtual-keyboard resize),
    // which is more reliable than only listening for a window 'resize'
    // event that may never fire if the window itself never changes size.
    let ro=null;
    if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(resize);ro.observe(canvas)}
    const onMove=e=>{const r=canvas.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top};
    const onLeave=()=>{mx=-9999;my=-9999};
    addEventListener('resize',resize);
    addEventListener('pointermove',onMove,{passive:true});
    addEventListener('pointerleave',onLeave);
    const color=dark?'255,255,255':'20,18,14';
    const tick=()=>{
      if(!live)return;
      if(!ready){raf=requestAnimationFrame(tick);return}
      ctx.clearRect(0,0,w,h);
      for(const p of parts){
        p.drift+=.004;
        let px=p.x*w+Math.sin(p.drift)*6,py=p.y*h+Math.cos(p.drift*.8)*6;
        // gentle repulsion from the cursor within a soft radius
        const dx=px-mx,dy=py-my,dist=Math.hypot(dx,dy),radius=90;
        if(dist<radius){
          const f=(radius-dist)/radius*.6;
          px+=(dx/(dist||1))*f*radius*.4;
          py+=(dy/(dist||1))*f*radius*.4;
        }
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<-.05)p.x=1.05;if(p.x>1.05)p.x=-.05;
        if(p.y<-.05)p.y=1.05;if(p.y>1.05)p.y=-.05;
        ctx.beginPath();
        ctx.fillStyle=`rgba(${color},${p.a})`;
        ctx.arc(px,py,p.r,0,Math.PI*2);
        ctx.fill();
      }
      raf=requestAnimationFrame(tick);
    };
    const onVis=()=>{
      if(document.hidden){cancelAnimationFrame(raf)}
      else{raf=requestAnimationFrame(tick)}
    };
    document.addEventListener('visibilitychange',onVis);
    raf=requestAnimationFrame(tick);
    return()=>{
      live=false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      removeEventListener('resize',resize);
      removeEventListener('pointermove',onMove);
      removeEventListener('pointerleave',onLeave);
      document.removeEventListener('visibilitychange',onVis);
    };
  },[dark,active,count]);
  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true"/>;
}

/* ---------- cursor-follow glow ---------- */
function CursorGlow(){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const move=e=>{el.style.setProperty('--gx',e.clientX+'px');el.style.setProperty('--gy',e.clientY+'px');el.classList.add('show')};
    const leave=()=>el.classList.remove('show');
    addEventListener('pointermove',move,{passive:true});
    addEventListener('pointerleave',leave);
    return()=>{removeEventListener('pointermove',move);removeEventListener('pointerleave',leave)}
  },[]);
  return <div ref={ref} className="cursor-glow"/>;
}

/* ---------- magnetic button interaction ---------- */
const magnetic=e=>{
  const el=e.currentTarget,r=el.getBoundingClientRect();
  el.style.setProperty('--mx',((e.clientX-r.left-r.width/2)*.28)+'px');
  el.style.setProperty('--my',((e.clientY-r.top-r.height/2)*.28)+'px');
};
const unmagnetic=e=>{e.currentTarget.style.setProperty('--mx','0px');e.currentTarget.style.setProperty('--my','0px')};

/* ---------- tilt interaction for power cards ---------- */
const tilt=e=>{
  const el=e.currentTarget,r=el.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
  el.style.setProperty('--rx',(-py*9)+'deg');
  el.style.setProperty('--ry',(px*13)+'deg');
  el.style.setProperty('--gx',(e.clientX-r.left)+'px');
  el.style.setProperty('--gy',(e.clientY-r.top)+'px');
};
const untilt=e=>{e.currentTarget.style.setProperty('--rx','0deg');e.currentTarget.style.setProperty('--ry','0deg')};

/* ---------- intro (book + sigil lock) ----------
   `muted` defaults to true for every cinematic (bookslam, wrong/correct
   password) exactly as before. Only the very first prologue clip passes
   `muted={false}`, so that one plays with sound - everything else in the
   app stays silent. Browsers commonly block unmuted autoplay before any
   user gesture; if that happens here, `needsPlay` already falls back to
   the "Begin cinematic" tap prompt, and that tap itself is the user
   gesture that lets the sound play on the retry. */
function Video({src,onEnded,playKey,muted=true}){
  const ref=useRef(null); const [needsPlay,setNeedsPlay]=useState(false);
  useEffect(()=>{const v=ref.current;if(!v)return; v.muted=muted;v.playsInline=true;v.currentTime=0;setNeedsPlay(false); const p=v.play(); if(p?.catch)p.catch(()=>setNeedsPlay(true)); return()=>v.pause()},[src,playKey,muted]);
  return <><video ref={ref} src={src} autoPlay muted={muted} playsInline preload="auto" onEnded={onEnded} onError={()=>setNeedsPlay(true)}/>{needsPlay&&<button className="begin" onClick={()=>{ref.current?.play().then(()=>setNeedsPlay(false)).catch(()=>{})}}>▶ Begin cinematic</button>}</>;
}
function Intro({onComplete}){
  const SEAL_KEY='vexa-grimoire-seal-v1';
  const [saved]=useState(()=>{try{const arr=JSON.parse(localStorage.getItem(SEAL_KEY));return Array.isArray(arr)&&arr.length>=3?arr:null}catch{return null}});
  const mode=saved?'verify':'setup';
  const [stage,setStage]=useState('intro'),[locked,setLocked]=useState(false),[feedback,setFeedback]=useState(null),
    [path,setPath]=useState([]),[bad,setBad]=useState(false),[playKey]=useState(0);
  const nodes=Array.from({length:9},(_,i)=>({x:52+(i%3)*92,y:52+Math.floor(i/3)*92}));
  const point=e=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*300/r.width,y:(e.clientY-r.top)*300/r.height}};
  const hit=p=>nodes.findIndex(n=>Math.hypot(n.x-p.x,n.y-p.y)<27);
  const down=e=>{e.currentTarget.setPointerCapture?.(e.pointerId);const i=hit(point(e));if(i>=0){setBad(false);setPath([i])}};
  const move=e=>{if(!e.currentTarget.hasPointerCapture?.(e.pointerId))return;const i=hit(point(e));if(i>=0)setPath(p=>p.includes(i)?p:[...p,i])};
  const up=e=>{
    if(!path.length)return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if(mode==='setup'){
      if(path.length<3){setBad(true);setPath([]);return}
      try{localStorage.setItem(SEAL_KEY,JSON.stringify(path))}catch{}
      setFeedback('correct');
    }else{
      const ok=path.length===saved.length&&path.every((n,i)=>n===saved[i]);
      if(ok)setFeedback('correct');else setFeedback('wrong');
    }
  };
  const resetSeal=()=>{try{localStorage.removeItem(SEAL_KEY)}catch{};location.reload()};
  return <div className="intro-layer">
    {stage==='intro'&&<div className="cinema"><Video src="/video/intro.mp4" playKey={playKey} muted={false} onEnded={()=>setStage('book')}/><div className="cinema-vignette"/><div className="cinema-ui"><span>VEXA / PROLOGUE</span><span>01 — AWAKENING</span></div><button className="skip" onClick={()=>setStage('book')}>SKIP CINEMATIC ↗</button></div>}
    {stage==='book'&&<div className="cinema book-stage">
      <Video src="/video/bookslam.mp4" playKey={playKey} onEnded={()=>setLocked(true)}/>
      <div className="cinema-vignette"/>
      {!locked&&<><div className="cinema-ui"><span>THE GRIMOIRE</span><span>02 — SEALED</span></div><button className="skip" onClick={()=>setLocked(true)}>SKIP TO SEAL ↗</button></>}
      {locked&&<div className="sigil-overlay"><div className="lock-card">
        <div className="lock-top"><span>VEXA'S GRIMOIRE</span><i>{mode==='setup'?'UNSEALED':'SEALED'}</i></div>
        <h2>{mode==='setup'?'Draw your own sigil.':'Trace the ancient sigil.'}</h2>
        <p>{bad?(mode==='setup'?'Too short a mark — trace at least three points.':'The seal rejected your mark. The book remains closed.'):(mode==='setup'?'Draw it straight onto the page. This mark will bind itself to the book from now on.':'Follow the old path. Do not lift your finger.')}</p>
        <div className={'sigil '+(bad?'bad':'')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{<svg viewBox="0 0 300 300">{path.slice(1).map((idx,i)=>{const a=nodes[path[i]],b=nodes[idx];return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>})}{nodes.map((n,i)=><circle key={i} cx={n.x} cy={n.y} r={path.includes(i)?10:6} className={path.includes(i)?'on':''}/>)}</svg>}</div>
        {mode==='verify'&&bad&&<button className="retry" onClick={resetSeal}>Forgot the mark? Reset the seal</button>}
        <small>THE LIGHT NEVER LEAVES.</small>
      </div></div>}
    </div>}
    {feedback==='wrong'&&<div className="cinema result overlay"><Video src="/video/wrong_pass.mp4" playKey={playKey} onEnded={()=>{setFeedback(null);setBad(true);setPath([])}}/></div>}
    {feedback==='correct'&&<div className="cinema result overlay"><Video src="/video/correct_password.mp4" playKey={playKey} onEnded={onComplete}/><div className="handoff">THE STORY CONTINUES</div></div>}
  </div>
}

function Particles({dark}){return <div className="particles">{Array.from({length:90},(_,i)=><i key={i} style={{'--i':i,'--x':`${(i*47)%100}%`,'--y':`${(i*71)%100}%`,'--d':`${4+(i%8)}s`,'--delay':`${-(i%9)}s`}} className={dark?'p darkp':'p'}/>)}</div>}

/* =====================================================================
   ---------- PAGED SITE (post-lock) ----------
   Replaces the old scrolling one-page world with four discrete "pages"
   (home / about / powers / mission), each a full-bleed background image
   with transparent hit-areas over the buttons that are baked directly
   into the artwork. Moving between home and a sub-page plays a short
   transition video that sits pixel-for-pixel on top of the still image
   underneath it; going back plays the exact same clip in reverse rather
   than needing a second "reverse" clip to be authored/uploaded.
   ===================================================================== */

/* ---------- page media, per theme ---------- */
const PAGE_IMG={
  home:{light:'/assets/pages/home-light.png',dark:'/assets/pages/home-dark.png'},
  about:{light:'/assets/pages/about-light.png',dark:'/assets/pages/about-dark.png'},
  powers:{light:'/assets/pages/powers-light.png',dark:'/assets/pages/powers-dark.png'},
  mission:{light:'/assets/pages/mission-light.png',dark:'/assets/pages/mission-dark.png'},
  /* the "portal" page - visitors step through the ring on home into an
     open sky, and the chat lives here rather than in a floating panel */
  chat:{light:'/assets/pages/chat-light.png',dark:'/assets/pages/chat-dark.png'}
};
const PAGE_TRANSITION={
  about:{light:'/video/pages/home-to-about-light.mp4',dark:'/video/pages/home-to-about-dark.mp4'},
  powers:{light:'/video/pages/home-to-powers-light.mp4',dark:'/video/pages/home-to-powers-dark.mp4'},
  mission:{light:'/video/pages/home-to-mission-light.mp4',dark:'/video/pages/home-to-mission-dark.mp4'},
  chat:{light:'/video/pages/portal-light.mp4',dark:'/video/pages/portal-dark.mp4'}
};

/* ---------- transition video: plays forward (home -> sub-page) or, for
   the back button, plays the very same clip in reverse by manually
   walking currentTime backwards frame-by-frame (native <video> can't
   play backwards on its own). Sits absolutely over the still image below
   it, filling the screen exactly the same way, so the two are always
   perfectly registered while the clip is running. ---------- */
/* ---------- transition video: plays forward (home -> sub-page) or, for
   the back button, plays the very same clip in reverse by manually
   walking currentTime backwards (native <video> can't play backwards on
   its own). Reverse stepping is *paced by the previous seek actually
   finishing* (via the 'seeked' event) rather than firing a new seek every
   animation frame regardless - blindly seeking 60x/sec queues up far more
   seeks than the decoder can service and is what causes the reverse play
   to stutter/lag. This way it only ever asks for the next frame once the
   last one has genuinely landed, gracefully adapting to however fast the
   device can actually seek instead of falling behind. */
function PageTransitionVideo({src,reverse,onDone}){
  const ref=useRef(null);
  useEffect(()=>{
    const v=ref.current;if(!v)return;
    let cancelled=false,raf=null,seeking=false,startTs=null,startTime=0;
    v.muted=true;v.playsInline=true;v.loop=false;
    const finish=()=>{if(!cancelled)onDone&&onDone()};
    const onSeeked=()=>{seeking=false};
    const stepReverse=now=>{
      if(cancelled)return;
      if(startTs==null)startTs=now;
      if(!seeking){
        const elapsed=(now-startTs)/1000;
        const target=startTime-elapsed;
        if(target<=0.02){try{v.currentTime=0}catch{};finish();return}
        seeking=true;
        try{v.currentTime=target}catch{seeking=false}
      }
      raf=requestAnimationFrame(stepReverse);
    };
    const start=()=>{
      if(cancelled)return;
      if(reverse){
        v.pause();
        startTime=v.duration||0;
        try{v.currentTime=Math.max(0,startTime-0.001)}catch{}
        startTs=null;
        raf=requestAnimationFrame(stepReverse);
      }else{
        v.currentTime=0;const p=v.play();if(p?.catch)p.catch(()=>{})
      }
    };
    v.addEventListener('seeked',onSeeked);
    if(v.readyState>=1)start();else v.addEventListener('loadedmetadata',start,{once:true});
    const onEnded=()=>{if(!reverse)finish()};
    v.addEventListener('ended',onEnded);
    return()=>{cancelled=true;if(raf)cancelAnimationFrame(raf);v.removeEventListener('seeked',onSeeked);v.removeEventListener('loadedmetadata',start);v.removeEventListener('ended',onEnded);v.pause()}
  },[src,reverse]);
  return <video ref={ref} src={src} className="page-transition-video" muted playsInline preload="auto"/>;
}

/* ---------- scroll-reveal wrapper ----------
   Cheap, one-shot: an IntersectionObserver flips a single class the first
   time a section enters the viewport, then disconnects. No scroll-linked
   JS runs after that - the actual motion is a plain CSS transition, so
   scrolling itself stays 100% native/GPU and never touches the main
   thread per-frame. */
function Reveal({as:Tag='div',className='',children,...rest}){
  const ref=useRef(null),[shown,setShown]=useState(false);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const io=new IntersectionObserver(([e])=>{if(e.isIntersecting){setShown(true);io.disconnect()}},{threshold:.18,rootMargin:'0px 0px -8% 0px'});
    io.observe(el);
    return()=>io.disconnect();
  },[]);
  return <Tag ref={ref} className={className+' reveal '+(shown?'in':'')} {...rest}>{children}</Tag>;
}

/* ---------- the 6 minimal power cards ----------
   Resting state shows only the number + name - the description lives in
   the exact same spot underneath and crossfades in on hover/tap, so the
   card never grows, no popup or tooltip ever appears, and the row stays
   a single tidy line. Only transform/opacity/filter/box-shadow move, all
   compositor-friendly. */
function PowerCard({card,active,onTap}){
  return <button type="button" className={'power-card'+(active?' active':'')} onClick={()=>onTap(card.tag)}>
    <span className="power-card-aura" aria-hidden="true"/>
    <span className="power-card-tag">{card.tag}</span>
    <span className="power-card-face">
      <span className="power-card-name">{card.name}</span>
      <span className="power-card-desc">{card.desc}</span>
    </span>
  </button>;
}

/* ---------- About page: interactive black/white balance ----------
   A single draggable point between the two swatches - 0 sits fully in
   BLACK, 100 fully in WHITE, 50 is the resting middle. Dragging it
   brightens/dims the two halves in real time and swaps in a short line
   that matches wherever the visitor left it, so the "one being, two
   sides" idea in the copy is something you can actually feel, not just
   read. Pointer handling only touches CSS custom properties/opacity -
   compositor-friendly, no layout thrash - and there's no animation loop:
   it only updates on an actual pointer move. */
const BALANCE_READOUT=[
  {max:20,text:'All the way into the dark. That\'s allowed - stay as long as you need.'},
  {max:40,text:'Mostly the low place tonight. It\'s still part of the same being.'},
  {max:60,text:'Right in the middle - both at once. Most of us live here.'},
  {max:80,text:'Mostly the light tonight. Let it carry you forward.'},
  {max:101,text:'All the way into the light. Hold on to this.'}
];
function BalanceSlider({value,onChange}){
  const trackRef=useRef(null);
  const pctFromEvent=e=>{
    const el=trackRef.current;if(!el)return value;
    const r=el.getBoundingClientRect();
    return Math.min(100,Math.max(0,((e.clientX-r.left)/r.width)*100));
  };
  const down=e=>{e.currentTarget.setPointerCapture?.(e.pointerId);onChange(pctFromEvent(e))};
  const move=e=>{if(!e.currentTarget.hasPointerCapture?.(e.pointerId))return;onChange(pctFromEvent(e))};
  const up=e=>{e.currentTarget.releasePointerCapture?.(e.pointerId)};
  const nudge=d=>onChange(v=>Math.min(100,Math.max(0,v+d)));
  const key=e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();nudge(-4)}
    else if(e.key==='ArrowRight'){e.preventDefault();nudge(4)}
  };
  const readout=BALANCE_READOUT.find(r=>value<r.max).text;
  return <div className="balance">
    <div className="balance-ends"><span>BLACK</span><span>WHITE</span></div>
    <div className="balance-track" ref={trackRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="balance-fill" style={{width:value+'%'}}/>
      <div className="balance-thumb" style={{left:value+'%'}}
        role="slider" tabIndex={0} aria-label="Balance between black and white"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}
        onKeyDown={key}/>
    </div>
    <p className="balance-readout">{readout}</p>
  </div>;
}
function AboutContent(){
  const [bal,setBal]=useState(50);
  // 55%-100% brightness range so neither side ever fully disappears -
  // this is about emphasis, not making either half vanish.
  const blackOn={opacity:.55+(100-bal)/100*.45};
  const whiteOn={opacity:.55+bal/100*.45};
  return <div className="page-fit">
    <Reveal as="section" className="fit-block">
      <span className="eyebrow">{ABOUT_COPY.eyebrow}</span>
      <h2 className="fit-title">{ABOUT_COPY.title}</h2>
      <p className="fit-sub">{ABOUT_COPY.lede}</p>
      <div className="duality-split">
        <div className="duality-half" style={blackOn}>
          <span className="swatch-dot black"/>
          <b>BLACK</b>
          <p>{ABOUT_COPY.black}</p>
        </div>
        <div className="duality-rule" aria-hidden="true"/>
        <div className="duality-half" style={whiteOn}>
          <span className="swatch-dot white"/>
          <b>WHITE</b>
          <p>{ABOUT_COPY.white}</p>
        </div>
      </div>
      <BalanceSlider value={bal} onChange={setBal}/>
      <p className="fit-line">{ABOUT_COPY.closing}</p>
      <p className="fit-tagline">{ABOUT_COPY.tagline}</p>
    </Reveal>
  </div>;
}

/* ---------- Powers page: one still screen, no scroll ---------- */
function PowersContent(){
  const [active,setActive]=useState(null);
  return <div className="page-fit">
    <Reveal as="section" className="fit-block powers-block">
      <span className="eyebrow">POWERS</span>
      <h2 className="fit-title">The Powers of VEXA</h2>
      <div className="duality-split with-center">
        <div className="duality-half">
          <span className="swatch-dot black"/>
          <b>{POWER_SIDES[0].label}</b>
          <p>{POWER_SIDES[0].short}</p>
        </div>
        <div className="duality-center">
          {POWER_PRINCIPLES.map(p=><div key={p.name} className="stat"><b>{p.name}</b><p>{p.short}</p></div>)}
        </div>
        <div className="duality-half">
          <span className="swatch-dot white"/>
          <b>{POWER_SIDES[1].label}</b>
          <p>{POWER_SIDES[1].short}</p>
        </div>
      </div>
      <div className="power-row" onClick={e=>{if(e.target===e.currentTarget)setActive(null)}}>
        {POWER_CARDS.map(c=><PowerCard key={c.tag} card={c} active={active===c.tag} onTap={tag=>setActive(a=>a===tag?null:tag)}/>)}
      </div>
    </Reveal>
  </div>;
}

/* ---------- Mission page: one still screen, no scroll ---------- */
function MissionContent({onGoChat}){
  return <div className="page-fit">
    <Reveal as="section" className="fit-block">
      <span className="eyebrow">{MISSION_COPY.eyebrow}</span>
      <h2 className="fit-title big">{MISSION_COPY.title}</h2>
      <p className="fit-line">{MISSION_COPY.body}</p>
      <div className="mission-words">
        {MISSION_COPY.words.map((w,i)=><React.Fragment key={w}>{i>0&&<span className="dot">•</span>}<span className="mission-word">{w}</span></React.Fragment>)}
      </div>
      <p className="fit-tagline">{MISSION_COPY.tagline}</p>
      {onGoChat&&<button className="mission-cta magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={onGoChat}>Talk to VEXA<span>↗</span></button>}
    </Reveal>
  </div>;
}

/* ---------- orientation gate ----------
   VEXA's artwork and layout are built for landscape; on a touch device
   held in portrait we show a full-screen "please rotate" card instead of
   the site, rather than trying to cram a landscape composition into a
   tall narrow screen. Desktops/laptops (fine pointer) are never gated,
   even if their window happens to be tall and narrow.
   Perf note: while the gate is up we also pause every <video> on the
   page (they'd otherwise keep decoding/playing behind an opaque overlay
   the person can't even see) and resume whichever ones were actually
   playing the moment the phone is rotated back - one tiny effect, no
   polling, no per-frame work either way. */
function useOrientationGate(){
  const getGated=()=>{
    try{
      return matchMedia('(pointer:coarse)').matches && matchMedia('(orientation:portrait)').matches;
    }catch{return false}
  };
  const [gated,setGated]=useState(getGated);
  useEffect(()=>{
    const check=()=>setGated(getGated());
    check();
    addEventListener('resize',check);
    addEventListener('orientationchange',check);
    let mq;
    try{mq=matchMedia('(orientation:portrait)');mq.addEventListener?.('change',check)}catch{}
    return()=>{
      removeEventListener('resize',check);
      removeEventListener('orientationchange',check);
      try{mq?.removeEventListener?.('change',check)}catch{}
    };
  },[]);
  useEffect(()=>{
    const vids=Array.from(document.querySelectorAll('video'));
    if(gated){
      vids.forEach(v=>{v.dataset.vexaWasPlaying=v.paused?'0':'1';v.pause()});
    }else{
      vids.forEach(v=>{if(v.dataset.vexaWasPlaying==='1'){const p=v.play();if(p?.catch)p.catch(()=>{})}});
    }
  },[gated]);
  return gated;
}

function OrientationGate(){
  return <div className="orientation-gate" role="alert">
    <svg className="rotate-icon" viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">
      <rect x="20" y="8" width="24" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="32" cy="42" r="1.6" fill="currentColor"/>
      <path d="M46 20a16 16 0 1 1-5-11.4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M46 6v9h-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <p className="rotate-title">Turn your device sideways</p>
    <p className="rotate-sub">VEXA is a landscape experience — rotate to continue.</p>
  </div>;
}

/* ---------- one full-screen page: a background image plus whatever
   transparent hit-areas sit over that image's own baked-in buttons, plus
   (on any sub-page) our own themed Back button - the artwork's baked-in
   back button/text was inconsistent page to page, so it's been painted
   out of the images and replaced with one consistent control here.
   Image and (when present) transition video always share the exact same
   fixed full-bleed box, so they stay lined up on top of one another. When
   `themeAnim` is set (mid light/dark morph) the previous theme's image is
   shown underneath while the new one wipes in over it. ---------- */
function PageStage({page,dark,themeAnim,transitioning,arrivingHome,onGoAbout,onGoPowers,onGoMission,onGoChat,onGoBack}){
  const img=PAGE_IMG[page][dark?'dark':'light'];
  // Going home is the one navigation that's expensive to arrive at: the two
  // hero clips only ever existed once `page==='home'`, so every trip back
  // from a sub-page mounted both fresh at the exact instant the reverse
  // video finished - new <video> elements, metadata load, first decoded
  // frame, first chroma-key pass, all landing in one synchronous burst right
  // as the reverse clip hands off, which is exactly the stutter this was
  // causing. `arrivingHome` (true for the whole duration of a backward
  // transition, since backward always resolves to home) lets this mount
  // early instead - invisible and non-interactive - so the loading/decoding
  // cost is spread across the ~1s the reverse clip is already playing, and
  // by the time home actually needs to show it's already warmed up and
  // simply fades in.
  const showHomeFg=page==='home'||arrivingHome;
  const homeFgClass='home-fg'
    +(page==='home'&&transitioning?' fading':'')
    +(page!=='home'?' warming':'');
  return <div className="page-stage">
    {themeAnim&&<img className="page-bg under" src={PAGE_IMG[page][themeAnim]} alt="" decoding="async"/>}
    <img key={img} className={'page-bg '+(themeAnim?'morph':'')} src={img} alt="" decoding="async" fetchpriority="high"/>
    {themeAnim&&<div className="theme-morph-ring"/>}
    {showHomeFg&&<div className={homeFgClass}>
      {/* ambient motes for the home scene - gold flecks in light mode, cool
          pale flecks in dark mode, matching the same duality palette used
          everywhere else. This reuses the existing pure-CSS particle
          animation (no JS animation loop, no canvas, no per-frame cost) so
          it doesn't add anything to the home page's already-heavier
          chroma-key workload. */}
      <Particles dark={dark}/>
      <button className="hit hit-about" onClick={onGoAbout} aria-label="About" disabled={transitioning||page!=='home'}/>
      <button className="hit hit-powers" onClick={onGoPowers} aria-label="Powers" disabled={transitioning||page!=='home'}/>
      <button className="hit hit-mission" onClick={onGoMission} aria-label="Mission" disabled={transitioning||page!=='home'}/>
      {/* small, ambient - standing inside the ring, not a focal element.
          Both themes stay mounted and playing at all times and simply
          cross-dissolve on toggle (one opacity transition, see CSS) -
          a proper morph instead of a hard swap the instant the theme
          flips. It's part of .home-fg like everything else here, so it
          eases out together with the hotspots the moment a transition
          starts, rather than being yanked off the DOM on frame one. */}
      <ChromaVideo src={HERO_LOOP.dark} className={'home-hero-canvas '+(dark?'':'hero-hide')} capWidth={smallScreenCap()} hidden={!dark}/>
      <ChromaVideo src={HERO_LOOP.light} className={'home-hero-canvas '+(dark?'hero-hide':'')} capWidth={smallScreenCap()} hidden={dark}/>
      <button className="portal-cta" onClick={onGoChat} aria-label="Chat with VEXA" disabled={transitioning||page!=='home'}>Chat with VEXA<span>↗</span></button>
    </div>}
    {page==='about'&&!transitioning&&<AboutContent/>}
    {page==='powers'&&!transitioning&&<PowersContent/>}
    {page==='mission'&&!transitioning&&<MissionContent onGoChat={onGoChat}/>}
    {page!=='home'&&page!=='chat'&&!transitioning&&<button className="back-btn" onClick={onGoBack} aria-label="Back"><span className="back-arrow">←</span>Back</button>}
  </div>;
}

function App(){
 const gated=useOrientationGate();
 const [intro,setIntro]=useState(true),
  [dark,setDark]=useState(()=>{try{return localStorage.getItem('vexa-theme')==='dark'}catch{return false}}),
  [chatText,setChatText]=useState(''),
  [messages,setMessages]=useState(()=>{
   try{const raw=JSON.parse(localStorage.getItem('vexa-chat-history'));if(Array.isArray(raw)&&raw.length)return raw}catch{}
   return[{from:'vexa',text:'Hey! I\'m VEXA. I help people who need someone to listen. What\'s your name?'}];
  }),
  [typing,setTyping]=useState(false),
  /* ---------- paged navigation state ----------
     `page` is whichever of home/about/powers/mission is currently shown;
     `pageTransition` (while non-null) drives the transition video
     overlaying the still image underneath it - {target,dir} where dir is
     'forward' (home -> target) or 'backward' (target -> home, playing the
     same clip in reverse). */
  [page,setPage]=useState('home'),
  [pageTransition,setPageTransition]=useState(null),
  /* previous theme name while a light/dark morph is playing (see
     toggleTheme) - null the rest of the time */
  [themeAnim,setThemeAnim]=useState(null),
  /* ---------- intake state ----------
     Walks every visitor through name -> age -> location -> email before
     the free-form supportive chat opens up, per the brief. Persisted so a
     refresh doesn't lose progress mid-conversation. */
  [intakeStage,setIntakeStage]=useState(()=>{try{return localStorage.getItem('vexa-intake-stage')||'name'}catch{return 'name'}}),
  [visitor,setVisitor]=useState(()=>{try{return JSON.parse(localStorage.getItem('vexa-visitor'))||{}}catch{return {}}}),
  [emailSent,setEmailSent]=useState(false);
 useEffect(()=>{try{localStorage.setItem('vexa-chat-history',JSON.stringify(messages.slice(-40)))}catch{}},[messages]);
 useEffect(()=>{try{localStorage.setItem('vexa-intake-stage',intakeStage)}catch{}},[intakeStage]);
 useEffect(()=>{try{localStorage.setItem('vexa-visitor',JSON.stringify(visitor))}catch{}},[visitor]);
 // full-screen chat feed now needs its own scroll-to-latest, since it's
 // real page-length content rather than a small fixed-height box
 const chatStreamRef=useRef(null);
 useEffect(()=>{
  const el=chatStreamRef.current;if(!el)return;
  el.scrollTo({top:el.scrollHeight,behavior:'smooth'});
 },[messages,typing,page]);

 /* ---------- page navigation ----------
    Forward: home -> a sub-page, playing that page's transition clip
    forward. Back: the same clip in reverse, ending back on home. Ignored
    mid-transition so clicks can't stack. */
 const goPage=target=>{
  if(pageTransition||page!=='home'||target==='home')return;
  setPageTransition({target,dir:'forward'});
 };
 const goBack=()=>{
  if(pageTransition||page==='home')return;
  setPageTransition({target:page,dir:'backward'});
 };
 // direct hop straight to a page with no transition clip - used by the
 // "Talk to VEXA" link on the mission page, since the cinematic portal
 // clip only makes sense stepping out from the home ring itself.
 const goDirect=target=>{
  if(pageTransition||page===target)return;
  setPage(target);
 };
 const onPageTransitionDone=()=>{
  const t=pageTransition;
  if(!t)return;
  setPage(t.dir==='forward'?t.target:'home');
  setPageTransition(null);
 };
 // theme swap is instant - it just changes which image/video set the
 // current page pulls from - but ignored mid-transition so the clip
 // finishes on the theme it started with.
 // theme swap now plays a quick iris-morph (the previous theme's image
 // wipes away to reveal the new one) instead of an instant hard cut -
 // ignored mid-transition/mid-morph so a clip or morph always finishes
 // cleanly before another can start.
 const THEME_MORPH_MS=950;
 const toggleTheme=force=>{
  if(pageTransition||themeAnim)return;
  const next=typeof force==='boolean'?force:!dark;
  if(next===dark)return;
  setThemeAnim(dark?'dark':'light');
  setDark(next);
  try{localStorage.setItem('vexa-theme',next?'dark':'light')}catch{}
  setTimeout(()=>setThemeAnim(null),THEME_MORPH_MS);
 };

 /* ---------- intake step handling ----------
    name -> age -> location -> email -> grievance -> done. Each reply is
    validated and echoed with a short in-character line before the next
    question, so it reads as a conversation rather than a form. Once the
    grievance is captured, the help-request email fires automatically and
    every message after that goes to the free-form supportive LLM chat. */
 const vexaSay=text=>setMessages(m=>[...m,{from:'vexa',text}]);
 const runIntake=async t=>{
  if(intakeStage==='name'){
   const name=t.replace(/^i'?m\s+|^my name is\s+/i,'').trim();
   setVisitor(v=>({...v,name}));
   setIntakeStage('age');
   setTimeout(()=>vexaSay(`Good to meet you, ${name}. Mind if I ask — how old are you?`),350);
   return;
  }
  if(intakeStage==='age'){
   const digits=t.match(/\d{1,3}/);
   if(!digits){setTimeout(()=>vexaSay('Just a number is fine — how old are you?'),300);return}
   setVisitor(v=>({...v,age:digits[0]}));
   setIntakeStage('location');
   setTimeout(()=>vexaSay('Thank you. And where are you writing to me from — your city or town?'),350);
   return;
  }
  if(intakeStage==='location'){
   setVisitor(v=>({...v,location:t}));
   setIntakeStage('email');
   setTimeout(()=>vexaSay('Got it. Last thing — what\'s an email address where I can make sure your message actually reaches me?'),350);
   return;
  }
  if(intakeStage==='email'){
   const email=t.trim();
   if(!/^\S+@\S+\.\S+$/.test(email)){setTimeout(()=>vexaSay('That doesn\'t quite look like an email — could you type it again?'),300);return}
   setVisitor(v=>({...v,email}));
   setIntakeStage('grievance');
   setTimeout(()=>vexaSay('So... tell me. How can I help you?'),350);
   return;
  }
  if(intakeStage==='grievance'){
   const grievance=t;
   setVisitor(v=>{
    const full={...v,grievance};
    sendHelpRequestEmail(full).then(setEmailSent);
    return full;
   });
   setIntakeStage('done');
   setTimeout(()=>vexaSay('I hear you. That took something to say, and I\'m glad you did. I\'m right here with you — tell me more, whenever you\'re ready.'),400);
   return;
  }
 };
 const send=async()=>{
  const t=chatText.trim();if(!t)return;
  const withUser=[...messages,{from:'user',text:t}];
  setMessages(withUser);setChatText('');
  if(intakeStage!=='done'){await runIntake(t);return}
  const difficult=/sad|alone|lost|stress|stressed|hurt|pain|problem|difficult|worried|anxious|scared|fail|failure|depressed|cry|struggle/i.test(t);
  if(difficult)setTimeout(()=>toggleTheme(true),180);
  setTyping(true);
  const apiHistory=withUser.slice(-10).map(m=>({role:m.from==='user'?'user':'assistant',content:m.text}));
  let streamed='';
  setMessages(m=>[...m,{from:'vexa',text:''}]);
  try{
   await askVexaStream(apiHistory,dark,token=>{
    if(!streamed)setTyping(false);
    streamed+=token;
    setMessages(m=>{const c=[...m];c[c.length-1]={from:'vexa',text:streamed};return c});
   });
   if(!streamed)throw new Error('empty-stream');
  }catch(err){
   setTyping(false);
   const fallback=difficult?'Stay with me. You can tell me what is weighing on you, one piece at a time.':'I\'m listening. Tell me what is on your mind.';
   setMessages(m=>{const c=[...m];c[c.length-1]={from:'vexa',text:fallback};return c});
  }
 };
 const clearChat=()=>{
  const fresh=[{from:'vexa',text:'Hey! I\'m VEXA. I help people who need someone to listen. What\'s your name?'}];
  setMessages(fresh);setIntakeStage('name');setVisitor({});setEmailSent(false);
  try{localStorage.setItem('vexa-chat-history',JSON.stringify(fresh));localStorage.setItem('vexa-intake-stage','name');localStorage.setItem('vexa-visitor','{}')}catch{}
 };
 return <div className={'app pages-app '+(dark?'dark':'light')}>
  {gated&&<OrientationGate/>}
  {intro&&<Intro onComplete={()=>setIntro(false)}/>}
  {!intro&&<>
   <PageStage
    page={page}
    dark={dark}
    themeAnim={themeAnim}
    transitioning={!!pageTransition}
    arrivingHome={pageTransition?.dir==='backward'}
    onGoAbout={()=>goPage('about')}
    onGoPowers={()=>goPage('powers')}
    onGoMission={()=>goPage('mission')}
    onGoChat={page==='home'?()=>goPage('chat'):()=>goDirect('chat')}
    onGoBack={goBack}
   />
   {pageTransition&&<PageTransitionVideo
    key={pageTransition.target+'-'+pageTransition.dir+'-'+(dark?'dark':'light')}
    src={PAGE_TRANSITION[pageTransition.target][dark?'dark':'light']}
    reverse={pageTransition.dir==='backward'}
    onDone={onPageTransitionDone}
   />}
   <CursorGlow/>
   <div className="grain"/>

   <button className="theme page-theme magnetic" onMouseMove={magnetic} onMouseLeave={unmagnetic} onClick={()=>toggleTheme()} disabled={!!pageTransition||!!themeAnim}><span>{dark?'◐':'☼'}</span>{dark?'DARK':'LIGHT'}</button>

   {/* the chat lives full-screen on its own page (through the portal on
       home) - bubbles float directly over the scene instead of sitting
       inside a floating box, with a drifting particle field behind them
       for a bit of life. The global Back button (rendered by PageStage
       for any non-home page) already covers "leave the chat", so the
       header here only carries what's unique to the chat itself. */}
   {page==='chat'&&!pageTransition&&<div className="chat-page">
    <ParticleField dark={dark} active={page==='chat'}/>
    <button className="back-btn chat-back-btn" onClick={goBack} aria-label="Back"><span className="back-arrow">←</span>Back</button>
    <header className="chat-hd">
     <span className={'orb '+(typing?'thinking':'')}>V</span>
     <div className="chat-hd-id"><b>VEXA</b><small>{typing?'typing…':'present · listening'}</small></div>
     <button className="chat-clear" title="Clear conversation" onClick={clearChat}>↺</button>
    </header>
    <div className="chat-stream" ref={chatStreamRef}>
     <div className="chat-stream-inner">
      {messages.map((m,i)=><div key={i} className={'bubble '+m.from}>{m.text}</div>)}
      {typing&&<div className="bubble vexa typing"><span/><span/><span/></div>}
     </div>
    </div>
    <div className="chat-composer">
     <input value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Tell VEXA what's on your mind…"/>
     <button onClick={send} aria-label="Send">↑</button>
    </div>
    <small className="chat-foot">{emailSent?'✓ VEXA has been notified of your message.':'Your world can change. VEXA stays.'}</small>
   </div>}
  </>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
