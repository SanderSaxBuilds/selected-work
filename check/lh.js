/* Turns a raw Lighthouse result (from PageSpeed Insights or Microlink) into the small model the report uses.
   Works in the browser (window.LH) and in Node (module.exports) so the example report is built by the same code. */
(function(g){
"use strict";
var CATS=["performance","accessibility","best-practices","seo"];
var METRIC=["first-contentful-paint","largest-contentful-paint","total-blocking-time","cumulative-layout-shift","speed-index","interactive","max-potential-fid"];
/* audits that are better filed under one category when Lighthouse lists them in two */
var PREFER={"document-title":"seo","image-alt":"accessibility"};

function short(it){
  if(!it||typeof it!=="object")return "";
  var u=it.url||(it.source&&it.source.url)||(it.request&&it.request.url);
  if(typeof u==="string"&&u)return u;
  var n=it.node||it;
  if(n&&n.type==="node")return n.nodeLabel||n.selector||"";
  if(typeof it.label==="string")return it.label;
  if(typeof it.text==="string")return it.text;
  if(typeof it.entity==="string")return it.entity;
  return "";
}
function items(d){
  var out=[];
  if(!d)return out;
  var list=d.items||[];
  /* network dependency tree and similar list details wrap tables */
  if(d.type==="list"){list=[];(d.items||[]).forEach(function(s){if(s&&s.items)list=list.concat(s.items)})}
  for(var i=0;i<list.length&&out.length<4;i++){var s=short(list[i]);if(s&&out.indexOf(s)<0)out.push(String(s).slice(0,160))}
  return out;
}
function metric(a,id){
  var x=a[id];if(!x)return null;
  return {v:typeof x.numericValue==="number"?x.numericValue:null,s:typeof x.score==="number"?x.score:null,d:x.displayValue||""};
}
function normalize(lh,src){
  if(!lh||!lh.audits||!lh.categories)throw new Error("not a Lighthouse result");
  var a=lh.audits,cats={},home={};
  CATS.forEach(function(c){
    var cat=lh.categories[c];if(!cat)return;
    cats[c]=typeof cat.score==="number"?Math.round(cat.score*100):null;
    (cat.auditRefs||[]).forEach(function(r){if(!home[r.id]||PREFER[r.id]===c)home[r.id]=c});
  });
  var finds=[];
  Object.keys(home).forEach(function(id){
    var x=a[id];if(!x||METRIC.indexOf(id)>=0)return;
    var mode=x.scoreDisplayMode;
    if(mode!=="binary"&&mode!=="numeric"&&mode!=="metricSavings")return;
    if(typeof x.score!=="number"||x.score>=0.9)return;
    var sv=x.metricSavings||{};
    finds.push({id:id,cat:home[id],score:x.score,title:x.title||id,dv:x.displayValue||"",
      sav:{lcp:+sv.LCP||0,fcp:+sv.FCP||0,cls:+sv.CLS||0,tbt:+sv.TBT||0},items:items(x.details)});
  });
  var shot=a["final-screenshot"]&&a["final-screenshot"].details&&a["final-screenshot"].details.data;
  var cs=lh.configSettings||{};
  return {
    url:lh.requestedUrl||lh.finalUrl||"",final:lh.finalDisplayedUrl||lh.finalUrl||lh.mainDocumentUrl||"",
    at:lh.fetchTime||new Date().toISOString(),device:cs.formFactor==="desktop"?"desktop":"mobile",
    ver:lh.lighthouseVersion||"",src:src||"",cats:cats,
    m:{fcp:metric(a,"first-contentful-paint"),lcp:metric(a,"largest-contentful-paint"),tbt:metric(a,"total-blocking-time"),
       cls:metric(a,"cumulative-layout-shift"),tbw:metric(a,"total-byte-weight"),si:metric(a,"speed-index")},
    shot:typeof shot==="string"&&shot.indexOf("data:image/")===0?shot:"",
    finds:finds
  };
}
var api={normalize:normalize,CATS:CATS};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else g.LH=api;
})(typeof window!=="undefined"?window:this);
