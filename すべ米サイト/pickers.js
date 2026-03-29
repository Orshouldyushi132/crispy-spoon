(function(){
  const PICKER_SELECTOR='[data-picker]';
  let openPicker=null;

  function dispatchNative(el){
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function closePicker(picker){
    if(!picker) return;
    const menu=picker.querySelector("[data-picker-menu]");
    const trigger=picker.querySelector("[data-picker-trigger]");
    picker.classList.remove("is-open");
    picker.classList.remove("is-open-up");
    picker.style.removeProperty("--picker-open-space");
    if(menu) menu.hidden=true;
    if(trigger) trigger.setAttribute("aria-expanded","false");
    if(openPicker===picker) openPicker=null;
  }

  function updatePickerLayout(picker){
    if(!picker||!picker.classList.contains("is-open")) return;
    const menu=picker.querySelector("[data-picker-menu]");
    const trigger=picker.querySelector("[data-picker-trigger]");
    if(!menu||!trigger) return;
    picker.classList.remove("is-open-up");
    picker.style.setProperty("--picker-open-space","0px");
    const triggerRect=trigger.getBoundingClientRect();
    const menuHeight=menu.offsetHeight;
    const viewportPadding=16;
    const gap=10;
    const spaceBelow=window.innerHeight-triggerRect.bottom-viewportPadding;
    const spaceAbove=triggerRect.top-viewportPadding;
    const openUp=menuHeight>spaceBelow&&spaceAbove>spaceBelow;
    picker.classList.toggle("is-open-up",openUp);
    picker.style.setProperty("--picker-open-space",openUp?"0px":`${menuHeight+gap}px`);
  }

  function openPickerMenu(picker){
    const menu=picker.querySelector("[data-picker-menu]");
    const trigger=picker.querySelector("[data-picker-trigger]");
    if(!menu||!trigger) return;
    if(openPicker&&openPicker!==picker) closePicker(openPicker);
    picker.classList.add("is-open");
    menu.hidden=false;
    trigger.setAttribute("aria-expanded","true");
    openPicker=picker;
    updatePickerLayout(picker);
  }

  function togglePicker(picker){
    if(picker.classList.contains("is-open")) closePicker(picker);
    else openPickerMenu(picker);
  }

  function createOptionButton(text,meta,active,onClick){
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="picker-option"+(active?" is-active":"");
    btn.innerHTML=`<span>${text}</span>${meta?`<small>${meta}</small>`:""}`;
    btn.addEventListener("click",onClick);
    return btn;
  }

  function syncSelectPicker(picker){
    const select=picker.querySelector("select");
    const valueEl=picker.querySelector("[data-picker-value]");
    const optionsWrap=picker.querySelector("[data-picker-options]");
    if(!select||!valueEl||!optionsWrap) return;
    const selected=select.options[select.selectedIndex]||select.options[0];
    const label=selected?selected.textContent.trim():"";
    valueEl.textContent=label;
    valueEl.classList.toggle("is-placeholder",!String(select.value||"").trim());
    optionsWrap.innerHTML="";
    [...select.options].forEach(option=>{
      const text=option.textContent.trim();
      const meta="";
      const btn=createOptionButton(text,meta,option.selected,()=>{
        select.value=option.value;
        syncSelectPicker(picker);
        dispatchNative(select);
        closePicker(picker);
      });
      btn.setAttribute("role","option");
      btn.setAttribute("aria-selected",option.selected?"true":"false");
      optionsWrap.appendChild(btn);
    });
  }

  function pad(n){
    return String(n).padStart(2,"0");
  }

  function clampTimeHour(v,min,max){
    const n=Number(v);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
  }

  function parseTimeValue(v,minHour,maxHour){
    const text=String(v||"").trim();
    const m=/^(\d{2}):(\d{2})$/.exec(text);
    if(!m) return {hour:minHour,minute:0};
    return {
      hour:clampTimeHour(m[1],minHour,maxHour),
      minute:Math.max(0,Math.min(59,Number(m[2])))
    };
  }

  function syncTimePicker(picker){
    const input=picker.querySelector("input");
    const valueEl=picker.querySelector("[data-picker-value]");
    const previewEl=picker.querySelector("[data-time-preview]");
    const hourWrap=picker.querySelector("[data-time-hours]");
    const minuteWrap=picker.querySelector("[data-time-minutes]");
    if(!input||!valueEl||!hourWrap||!minuteWrap) return;
    const minHour=Number(picker.dataset.startHour||19);
    const maxHour=Number(picker.dataset.endHour||23);
    const current=parseTimeValue(input.value,minHour,maxHour);
    const display=`${pad(current.hour)}:${pad(current.minute)}`;
    valueEl.textContent=display;
    if(previewEl) previewEl.textContent=display;

    hourWrap.innerHTML="";
    for(let hour=minHour;hour<=maxHour;hour+=1){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="picker-time-btn"+(hour===current.hour?" is-active":"");
      btn.textContent=pad(hour);
      btn.addEventListener("click",()=>{
        input.value=`${pad(hour)}:${pad(parseTimeValue(input.value,minHour,maxHour).minute)}`;
        syncTimePicker(picker);
        dispatchNative(input);
      });
      hourWrap.appendChild(btn);
    }

    minuteWrap.innerHTML="";
    for(let minute=0;minute<60;minute+=1){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="picker-time-btn"+(minute===current.minute?" is-active":"");
      btn.textContent=pad(minute);
      btn.addEventListener("click",()=>{
        input.value=`${pad(parseTimeValue(input.value,minHour,maxHour).hour)}:${pad(minute)}`;
        syncTimePicker(picker);
        dispatchNative(input);
        closePicker(picker);
      });
      minuteWrap.appendChild(btn);
    }
  }

  function initSelectPicker(picker){
    const select=picker.querySelector("select");
    const trigger=picker.querySelector("[data-picker-trigger]");
    if(!select||!trigger) return;
    syncSelectPicker(picker);
    trigger.addEventListener("click",()=>togglePicker(picker));
    select.addEventListener("change",()=>syncSelectPicker(picker));
  }

  function initTimePicker(picker){
    const input=picker.querySelector("input");
    const trigger=picker.querySelector("[data-picker-trigger]");
    if(!input||!trigger) return;
    syncTimePicker(picker);
    trigger.addEventListener("click",()=>togglePicker(picker));
    input.addEventListener("change",()=>syncTimePicker(picker));
  }

  function buildPickerChrome(picker){
    const type=picker.dataset.picker;
    const chip=picker.dataset.chip||"PICK";
    const compact=picker.dataset.compact==="true";
    picker.classList.add("picker");
    if(compact) picker.classList.add("picker-compact");
    if(type==="select"){
      const select=picker.querySelector("select");
      const trigger=document.createElement("button");
      const sideIcon='<span class="picker-caret" aria-hidden="true"></span>';
      trigger.type="button";
      trigger.className="picker-trigger";
      trigger.setAttribute("data-picker-trigger","");
      trigger.setAttribute("aria-haspopup","listbox");
      trigger.setAttribute("aria-expanded","false");
      trigger.innerHTML=`<span class="picker-value" data-picker-value></span><span class="picker-side">${sideIcon}<span class="picker-chip">${chip}</span></span>`;
      const menu=document.createElement("div");
      menu.className="picker-menu";
      menu.hidden=true;
      menu.setAttribute("data-picker-menu","");
      menu.innerHTML='<div class="picker-option-grid" data-picker-options role="listbox"></div>';
      picker.appendChild(trigger);
      picker.appendChild(menu);
      if(select) select.tabIndex=-1;
      initSelectPicker(picker);
      return;
    }
    if(type==="time"){
      const input=picker.querySelector("input");
      const trigger=document.createElement("button");
      trigger.type="button";
      trigger.className="picker-trigger";
      trigger.setAttribute("data-picker-trigger","");
      trigger.setAttribute("aria-haspopup","dialog");
      trigger.setAttribute("aria-expanded","false");
      trigger.innerHTML=`<span class="picker-value" data-picker-value></span><span class="picker-side"><span class="picker-clock" aria-hidden="true"></span><span class="picker-chip">${chip}</span></span>`;
      const menu=document.createElement("div");
      menu.className="picker-menu picker-time-menu";
      menu.hidden=true;
      menu.setAttribute("data-picker-menu","");
      menu.innerHTML='<div class="picker-time-top"><span class="picker-chip subtle">START</span><strong data-time-preview></strong></div><div class="picker-time-grid"><section class="picker-time-col"><p>HOUR</p><div class="picker-hour-list" data-time-hours></div></section><section class="picker-time-col"><p>MIN</p><div class="picker-minute-list" data-time-minutes></div></section></div>';
      picker.appendChild(trigger);
      picker.appendChild(menu);
      if(input) input.tabIndex=-1;
      initTimePicker(picker);
    }
  }

  function initPickers(root=document){
    root.querySelectorAll(PICKER_SELECTOR).forEach(picker=>{
      if(picker.dataset.pickerReady==="true") return;
      picker.dataset.pickerReady="true";
      buildPickerChrome(picker);
      const form=picker.closest("form");
      if(form&&!form.dataset.pickerResetBound){
        form.dataset.pickerResetBound="true";
        form.addEventListener("reset",()=>setTimeout(()=>syncPickers(form),0));
      }
    });
  }

  function syncPickers(root=document){
    root.querySelectorAll(PICKER_SELECTOR).forEach(picker=>{
      if(picker.dataset.picker!=="select"&&picker.dataset.picker!=="time") return;
      if(picker.dataset.picker==="select") syncSelectPicker(picker);
      if(picker.dataset.picker==="time") syncTimePicker(picker);
    });
  }

  document.addEventListener("click",e=>{
    if(!openPicker) return;
    if(openPicker.contains(e.target)) return;
    closePicker(openPicker);
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&openPicker){
      closePicker(openPicker);
    }
  });

  window.addEventListener("resize",()=>{
    if(openPicker) updatePickerLayout(openPicker);
  });

  window.addEventListener("scroll",()=>{
    if(openPicker) updatePickerLayout(openPicker);
  },{passive:true});

  window.initCustomPickers=initPickers;
  window.syncCustomPickers=syncPickers;
  initPickers(document);
})();
