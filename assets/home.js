/* Home pages: the folio drawer, the index filter, old hash links. No libraries. */
(function(){
  var d=document,root=d.documentElement,rm=root.classList.contains('rm');
  function each(l,f){Array.prototype.forEach.call(l,f)}
  function load(img){
    if(img.dataset.srcset){img.srcset=img.dataset.srcset;img.removeAttribute('data-srcset')}
    if(img.dataset.src){img.src=img.dataset.src;img.removeAttribute('data-src')}
  }

  /* ---------- the drawer ---------- */
  var pile=d.getElementById('pile');
  if(pile){
    var cards=[].slice.call(pile.querySelectorAll('.card')),n=cards.length,cur=0,busy=false;
    var num=d.getElementById('cur'),drawer=d.getElementById('drawer');
    var open=d.getElementById('open'),opn=d.getElementById('opn');

    function lay(skip){
      cards.forEach(function(c,i){
        var p=(i-cur+n)%n;
        if(c===skip){c.style.transition='none'}
        c.style.setProperty('--p',Math.min(p,3));
        c.style.zIndex=n-p;
        c.classList.toggle('front',p===0);
        c.classList.toggle('gone',p>3);
        c.setAttribute('aria-hidden',p===0?'false':'true');
        c.tabIndex=p===0?0:-1;
        if(p<=4||p===n-1){each(c.querySelectorAll('img'),load);c.classList.add('lit')}
      });
      if(skip){skip.offsetWidth;skip.style.transition=''}
      var c=cards[cur];
      if(num)num.textContent=cur+1;
      root.style.setProperty('--desk',c.style.getPropertyValue('--bg'));
      if(open){open.href=c.getAttribute('href');opn.textContent=c.dataset.name}
    }

    function next(dir){
      if(busy)return;
      var c=cards[cur];dir=dir||-1;
      if(rm){cur=(cur+1)%n;lay();return}
      busy=true;
      c.classList.remove('drag','nudge');
      c.style.transform='translate('+(dir*115)+'vw,'+(40)+'px) rotate('+(dir*14)+'deg)';
      setTimeout(function(){
        cur=(cur+1)%n;
        c.style.transition='none';c.style.transform='';
        lay(c);busy=false;
      },330);
    }
    function prev(){
      if(busy)return;
      var i=(cur-1+n)%n,c=cards[i];
      if(rm){cur=i;lay();return}
      busy=true;
      each(c.querySelectorAll('img'),load);c.classList.add('lit');
      c.style.transition='none';
      c.classList.remove('gone');
      c.style.zIndex=n+1;
      c.style.transform='translate(-115vw,40px) rotate(-14deg)';
      c.offsetWidth;
      c.style.transition='';
      cur=i;lay();
      c.style.transform='';
      setTimeout(function(){busy=false},300);
    }
    function go(i){
      if(i===cur)return;
      if((i-cur+n)%n===1){next(-1);return}
      cur=i;lay();
    }

    /* drag the front folder, a throw sends it to the back */
    var sx=0,sy=0,dx=0,dy=0,t0=0,down=null,dragging=false,moved=false;
    pile.addEventListener('pointerdown',function(e){
      var c=e.target.closest('.card');
      if(!c||!c.classList.contains('front')||busy||(e.pointerType==='mouse'&&e.button!==0))return;
      down=c;sx=e.clientX;sy=e.clientY;dx=dy=0;t0=Date.now();dragging=false;moved=false;
      c.classList.remove('nudge');
    });
    addEventListener('pointermove',function(e){
      if(!down)return;
      dx=e.clientX-sx;dy=e.clientY-sy;
      if(!dragging){
        if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){dragging=true;moved=true;down.classList.add('drag');try{down.setPointerCapture(e.pointerId)}catch(_){}}
        else if(Math.abs(dy)>10){down=null;return}
        else return;
      }
      e.preventDefault();
      down.style.transform='translate('+dx+'px,'+(dy*.18)+'px) rotate('+(dx*.025)+'deg)';
    },{passive:false});
    function up(){
      if(!down)return;
      var c=down;down=null;
      if(!dragging)return;
      dragging=false;
      var v=Math.abs(dx)/Math.max(1,Date.now()-t0);
      c.classList.remove('drag');
      if(Math.abs(dx)>Math.min(140,c.offsetWidth*.22)||v>.55){next(dx>0?1:-1)}
      else{c.style.transform=''}
    }
    addEventListener('pointerup',up);
    addEventListener('pointercancel',up);
    pile.addEventListener('dragstart',function(e){e.preventDefault()});
    pile.addEventListener('click',function(e){
      var c=e.target.closest('.card');if(!c)return;
      if(moved){e.preventDefault();moved=false;return}
      if(!c.classList.contains('front')){e.preventDefault();go(cards.indexOf(c))}
    });
    each(d.querySelectorAll('.nav-b'),function(b){
      b.addEventListener('click',function(){b.dataset.d==='1'?next(-1):prev()});
    });
    drawer.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){e.preventDefault();next(-1);cards[cur].focus({preventScroll:true})}
      else if(e.key==='ArrowLeft'){e.preventDefault();prev();cards[cur].focus({preventScroll:true})}
    });

    lay();
    if(!rm){
      var nudged=false,fire=function(){if(nudged||cur!==0)return;nudged=true;cards[0].classList.add('nudge');
        cards[0].addEventListener('animationend',function(){cards[0].classList.remove('nudge')},{once:true})};
      if(d.readyState==='complete')setTimeout(fire,500);else addEventListener('load',function(){setTimeout(fire,400)});
    }
  }

  /* ---------- the index sheet ---------- */
  var rows=[].slice.call(d.querySelectorAll('.row'));
  function lit(r){r.classList.add('lit');each(r.querySelectorAll('img'),load)}
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){lit(e.target);io.unobserve(e.target)}})},{rootMargin:'500px 0px'});
    rows.forEach(function(r){io.observe(r)});
  }else rows.forEach(lit);

  each(d.querySelectorAll('.ftabs button'),function(b,_,all){
    b.addEventListener('click',function(){
      var g=b.dataset.g;
      each(d.querySelectorAll('.ftabs button'),function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
      rows.forEach(function(r){r.classList.toggle('off',!(g==='all'||r.dataset.g===g))});
    });
  });

  /* links into the earlier index (#data, #07 and similar) still land on the matching row or section */
  var A={"01":"01-northline","02":"02-werksupply","03":"03-financial-report","04":"04-ledgerlens","05":"05-property-documents","06":"06-daybreak","07":"07-field-frame","08":"08-countback","09":"09-migration-proof","10":"10-allex-website",all:"work","new":"work",data:"work",systems:"work",research:"work",websites:"work",content:"work",integrations:"work",space:"",top:""};
  function hop(){var h=location.hash.slice(1);try{h=decodeURIComponent(h)}catch(e){}
    if(!h||d.getElementById(h)||!A.hasOwnProperty(h))return;
    var t=A[h]&&d.getElementById(A[h]);if(t)t.scrollIntoView();else scrollTo(0,0)}
  hop();addEventListener('hashchange',hop);
})();
