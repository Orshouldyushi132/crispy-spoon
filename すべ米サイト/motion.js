(function(){
  const prefersReduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  let revealObserver=null;
  let openReady=false;
  let progressBar=null;
  let ambientBackdrop=null;
  const revealBound=new WeakSet();

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

  function refreshMotion(scope=document){
    const root=scope&&scope.querySelectorAll?scope:document;
    const revealSections=[
      ...root.querySelectorAll(".top > .card, section.card, .participant-grid > *, .info-grid > .guide, .stats > .stat, .plan-item")
    ];
    bindRevealGroup(revealSections,0,46);

    const timelineItems=[...root.querySelectorAll(".item")];
    bindRevealGroup(timelineItems,30,36);
  }

  function init(){
    ensureChrome();
    bindViewportEffects();
    bindIntro();
    bindReveal(document.querySelector(".hero"),0);
    refreshMotion(document);
  }

  window.refreshSiteMotion=refreshMotion;

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
