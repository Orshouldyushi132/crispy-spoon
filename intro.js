(function(){
  const BODY_ACTIVE_CLASS = "intro-active";
  const BODY_DONE_CLASS = "intro-complete";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let finished = false;
  let siteReady = false;
  let finalCueReached = false;
  let keydownHandler = null;

  function finishIntro(intro, immediate = false){
    if(finished || !intro) return;
    finished = true;
    if(keydownHandler){
      window.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    intro.classList.add("is-exit");

    const applyDone = () => {
      document.body.classList.remove(BODY_ACTIVE_CLASS);
      document.body.classList.add(BODY_DONE_CLASS);
      setTimeout(() => {
        intro.remove();
        window.refreshSiteMotion?.(document);
      }, 720);
    };

    if(immediate || reducedMotion.matches){
      applyDone();
      return;
    }

    setTimeout(applyDone, 620);
  }

  function tryFinish(intro){
    if(finalCueReached && siteReady){
      finishIntro(intro);
    }
  }

  function splitTitle(title){
    const text = title.textContent || "";
    title.textContent = "";
    [...text].forEach((char, index) => {
      const span = document.createElement("span");
      span.className = `char${char.trim() ? "" : " is-space"}`;
      span.textContent = char;
      span.style.setProperty("--char-delay", `${index * 72}ms`);
      title.appendChild(span);
    });
  }

  function init(){
    const intro = document.getElementById("siteIntro");
    const title = document.getElementById("siteIntroTitle");
    if(!intro || !title) return;
    keydownHandler = (event) => {
      if(event.key === "Escape" || event.key === "Enter" || event.key === " "){
        finishIntro(intro, true);
      }
    };

    splitTitle(title);
    document.body.classList.add(BODY_ACTIVE_CLASS);

    const skip = () => finishIntro(intro, true);
    intro.addEventListener("click", skip);
    window.addEventListener("keydown", keydownHandler);

    if(reducedMotion.matches){
      intro.classList.add("is-visible", "is-title-in", "is-final");
      finalCueReached = true;
      setTimeout(() => finishIntro(intro, true), 280);
      return;
    }

    requestAnimationFrame(() => intro.classList.add("is-visible"));

    setTimeout(() => {
      intro.classList.add("is-title-in");
    }, 460);

    setTimeout(() => {
      intro.classList.add("is-final");
      finalCueReached = true;
      tryFinish(intro);
    }, 2120);

    setTimeout(() => {
      if(!finished){
        finishIntro(intro, true);
      }
    }, 6200);

    window.addEventListener("kome:public-ready", () => {
      siteReady = true;
      tryFinish(intro);
    }, { once: true });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }else{
    init();
  }
}());
