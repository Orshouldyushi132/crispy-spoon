(function(){
  const prefersReduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  let revealObserver=null;
  let openReady=false;
  let progressBar=null;
  let ambientBackdrop=null;
  const revealBound=new WeakSet();
  const anchorBound=new WeakSet();
  const rippleTimers=new WeakMap();

  function ensureChrome(){
    if(!document.querySelector(".scroll-progress")){
      progressBar=document.createElement("div");
      progressBar.className="scroll-progress";
      document.body.appendChild(progressBar);
    }else{
      progressBar=document.querySelector(".scroll-progress");
    }
    if(!document.querySelector(".ambient-backdrop")){
      ambientBackdrop=document.createElement("div");
      ambientBackdrop.className="ambient-backdrop";
      ambientBackdrop.setAttribute("aria-hidden","true");
      document.body.appendChild(ambientBackdrop);
    }else{
      ambientBackdrop=document.querySelector(".ambient-backdrop");
    }
  }

  function initObserver(){
    if(prefersReduced.matches||revealObserver) return;
    revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },{
      threshold:.16,
      rootMargin:"0px 0px -8% 0px"
    });
  }

  function updateProgress(){
    if(!progressBar) return;
    const doc=document.documentElement;
    const total=Math.max(1,doc.scrollHeight-window.innerHeight);
    const ratio=Math.min(1,Math.max(0,window.scrollY/total));
    progressBar.style.transform=`scaleX(${ratio})`;
  }

  function bindViewportEffects(){
    if(openReady) return;
    openReady=true;
    updateProgress();
    window.addEventListener("scroll",updateProgress,{passive:true});
  }

  function bindIntro(){
    if(document.body.dataset.motionIntro==="true") return;
    document.body.dataset.motionIntro="true";
    const introTargets=[
      ...document.querySelectorAll(".hero .eyebrow, .hero h1, .hero .lead, .hero .chips .chip, .hero .actions > *, .hero .panel")
    ];
    introTargets.forEach((el,index)=>{
      el.classList.add("motion-enter");
      el.style.animationDelay=`${index*80}ms`;
    });
    requestAnimationFrame(()=>document.body.classList.add("motion-ready"));
  }

  function bindReveal(el,delay=0){
    if(!el||revealBound.has(el)) return;
    revealBound.add(el);
    if(prefersReduced.matches){
      el.classList.add("is-visible");
      return;
    }
    initObserver();
    el.classList.add("fx-reveal");
    el.style.transitionDelay=`${delay}ms`;
    revealObserver.observe(el);
  }

  function bindRevealGroup(elements,baseDelay=0,step=70){
    elements.forEach((el,index)=>bindReveal(el,baseDelay+(index*step)));
  }

  function resolveRippleHost(target){
    if(!target) return null;
    if(target.closest){
      return target.closest(".form-shell, .status-panel, .item, .stack-card, .card, .hero, .toc-card, .site-header, .guide") || target;
    }
    return target;
  }

  function triggerRipple(target,options={}){
    const host=resolveRippleHost(target);
    if(!host||prefersReduced.matches) return;
    const rect=host.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0) return;
    const style=getComputedStyle(host);
    const ripple=document.createElement("span");
    ripple.className="nav-ripple";
    ripple.style.left=`${rect.left}px`;
    ripple.style.top=`${rect.top}px`;
    ripple.style.width=`${rect.width}px`;
    ripple.style.height=`${rect.height}px`;
    ripple.style.borderRadius=style.borderRadius||"20px";
    document.body.appendChild(ripple);
    host.classList.remove("is-nav-rippled");
    void host.offsetWidth;
    host.classList.add("is-nav-rippled");
    ripple.addEventListener("animationend",()=>ripple.remove(),{once:true});
    window.setTimeout(()=>host.classList.remove("is-nav-rippled"),1020);
  }

  function targetFromHash(hash){
    if(!hash||hash==="#") return null;
    const id=decodeURIComponent(hash.slice(1));
    return document.getElementById(id) || null;
  }

  function waitForScrollSettled(callback,options={}){
    const start=performance.now();
    const minWait=options.minWait ?? 180;
    const settleMs=options.settleMs ?? 140;
    const maxWait=options.maxWait ?? 1800;
    let lastX=window.scrollX;
    let lastY=window.scrollY;
    let lastMove=start;
    let frame=0;

    const finish=()=>{
      if(frame) cancelAnimationFrame(frame);
      callback();
    };

    const check=()=>{
      const now=performance.now();
      const x=window.scrollX;
      const y=window.scrollY;
      if(Math.abs(x-lastX)>.5||Math.abs(y-lastY)>.5){
        lastX=x;
        lastY=y;
        lastMove=now;
      }
      if(now-start>=minWait&&(now-lastMove>=settleMs||now-start>=maxWait)){
        finish();
        return;
      }
      frame=requestAnimationFrame(check);
    };

    frame=requestAnimationFrame(check);
  }

  function scheduleRipple(target,options={}){
    const host=resolveRippleHost(target);
    if(!host) return;
    const oldState=rippleTimers.get(host);
    if(oldState){
      oldState.cancelled=true;
      window.clearTimeout(oldState.timer);
    }
    const state={timer:0,cancelled:false};
    state.timer=window.setTimeout(()=>{
      waitForScrollSettled(()=>{
        if(state.cancelled) return;
        triggerRipple(host,options);
        if(rippleTimers.get(host)===state) rippleTimers.delete(host);
      },options);
    },options.delay ?? 0);
    rippleTimers.set(host,state);
  }

  function bindAnchorRipples(scope=document){
    const root=scope&&scope.querySelectorAll?scope:document;
    root.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor=>{
      if(anchorBound.has(anchor)) return;
      anchorBound.add(anchor);
      anchor.addEventListener("click",event=>{
        const target=targetFromHash(anchor.getAttribute("href"));
        if(!target) return;
        scheduleRipple(target,{
          clientX:event.clientX,
          clientY:event.clientY
        });
      });
    });
  }

  function refreshMotion(scope=document){
    const root=scope&&scope.querySelectorAll?scope:document;
    const revealSections=[
      ...root.querySelectorAll(".top > .card, section.card, .participant-grid > *, .info-grid > .guide, .stats > .stat, .plan-item")
    ];
    bindRevealGroup(revealSections,0,46);

    const timelineItems=[...root.querySelectorAll(".item")];
    bindRevealGroup(timelineItems,30,36);
    bindAnchorRipples(root);
  }

  function init(){
    ensureChrome();
    bindViewportEffects();
    bindIntro();
    bindReveal(document.querySelector(".hero"),0);
    refreshMotion(document);
    if(window.location.hash){
      const hashedTarget=targetFromHash(window.location.hash);
      if(hashedTarget) scheduleRipple(hashedTarget,{delay:220});
    }
    window.addEventListener("hashchange",()=>{
      const hashedTarget=targetFromHash(window.location.hash);
      if(hashedTarget) scheduleRipple(hashedTarget,{delay:120});
    });
  }

  window.refreshSiteMotion=refreshMotion;
  window.triggerSectionRipple=(target,options={})=>{
    if(typeof target==="string"){
      const resolved=target.startsWith("#")?targetFromHash(target):document.querySelector(target);
      if(resolved) scheduleRipple(resolved,options);
      return;
    }
    if(target) scheduleRipple(target,options);
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
