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
    const ripple=document.createElement("span");
    const size=Math.max(rect.width,rect.height)*1.35;
    const x=Number.isFinite(options.clientX)?options.clientX-rect.left:rect.width/2;
    const y=Number.isFinite(options.clientY)?options.clientY-rect.top:rect.height/2;
    ripple.className="nav-ripple";
    ripple.style.width=`${size}px`;
    ripple.style.height=`${size}px`;
    ripple.style.left=`${x}px`;
    ripple.style.top=`${y}px`;
    host.appendChild(ripple);
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

  function scheduleRipple(target,options={}){
    const host=resolveRippleHost(target);
    if(!host) return;
    const oldTimer=rippleTimers.get(host);
    if(oldTimer) window.clearTimeout(oldTimer);
    const timer=window.setTimeout(()=>{
      triggerRipple(host,options);
      rippleTimers.delete(host);
    },options.delay ?? 360);
    rippleTimers.set(host,timer);
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
          clientY:event.clientY,
          delay:380
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
