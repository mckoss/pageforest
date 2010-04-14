/* Begin file: namespace.js */
if(!window.console){(function(){var names=["log","debug","info","warn","error","assert","dir","dirxml","group","groupEnd","time","timeEnd","count","trace","profile","profileEnd"];window.console={};var noop=function(){};for(var i=0;i<names.length;++i){window.console[names[i]]=noop;}}());}
(function(){var sGlobal='global_namespace';if(window[sGlobal]){return;}
function Namespace(nsParent,sName){if(sName){sName=sName.replace(/-/g,'_');}
this._nsParent=nsParent;if(this._nsParent){this._nsParent[sName]=this;this._sPath=this._nsParent._sPath;if(this._sPath!==''){this._sPath+='.';}
this._sPath+=sName;}else{this._sPath='';}}
Namespace.prototype.extend=function(oDest,var_args){if(oDest===undefined){oDest={};}
for(var i=1;i<arguments.length;i++){var oSource=arguments[i];for(var prop in oSource){if(oSource.hasOwnProperty(prop)){oDest[prop]=oSource[prop];}}}
return oDest;};var ns=window[sGlobal]=new Namespace(null);ns.extend(Namespace.prototype,{'define':function(sPath,fnCallback){sPath=sPath.replace(/-/g,'_');var aPath=sPath.split('.');var nsCur=this;for(var i=0;i<aPath.length;i++){var sName=aPath[i];if(nsCur[sName]===undefined){var nsNew=new Namespace(nsCur,sName);}
nsCur=nsCur[sName];}
if(fnCallback){if(!nsCur._fDefined){nsCur._fDefined=true;fnCallback(nsCur);console.info("Namespace '"+nsCur._sPath+"' defined.");}else{console.warn("WARNING: Namespace '"+nsCur._sPath+"' redefinition.");}}else if(!nsCur._fDefined){console.warn("Namespace '"+nsCur._sPath+"' forward reference.");}
return nsCur;},'import':function(sPath){return window[sGlobal].define(sPath);},'SGlobalName':function(sInNamespace){sInNamespace=sInNamespace.replace(/-/g,'_');return sGlobal+'.'+this._sPath+'.'+sInNamespace;}});}());
/* Begin file: json2.js */
global_namespace.define('JSON',function(JSON){function f(n){return n<10?'0'+n:n;}
if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(key){return this.valueOf()?this.getUTCFullYear()+'-'+
f(this.getUTCMonth()+1)+'-'+
f(this.getUTCDate())+'T'+
f(this.getUTCHours())+':'+
f(this.getUTCMinutes())+':'+
f(this.getUTCSeconds())+'Z':null;};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf();};}
var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}
function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}
if(typeof rep==='function'){value=rep.call(holder,key,value);}
switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}
gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}
v=partial.length===0?'[]':gap?'[\n'+gap+
partial.join(',\n'+gap)+'\n'+
mind+']':'['+partial.join(',')+']';gap=mind;return v;}
if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==='string'){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}
v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+
mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}
if(typeof JSON.stringify!=='function'){JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}
rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}
return str('',{'':value});};}
if(typeof JSON.parse!=='function'){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}
return reviver.call(holder,key,value);}
cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+
('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}
if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}
throw new SyntaxError('JSON.parse');};}});
/* Begin file: formatutil.js */
global_namespace.define('startpad.format-util',function(NS){NS.extend(NS,{Thousands:function(d)
{var s=d.toString();var sLast="";while(s!=sLast)
{sLast=s;s=s.replace(/(\d+)(\d{3})/,"$1,$2");}
return s;},Slugify:function(s)
{s=s.Trim().toLowerCase();s=s.replace(/[^\w\s-]/g,'-').replace(/[-\s]+/g,'-').replace(/(^-+)|(-+$)/g,'');return s;},FormatNumber:function(val,digits)
{var nInt=Math.floor(val);var sInt=nInt.toString();var sLast="";while(sInt!=sLast)
{sLast=sInt;sInt=sInt.replace(/(\d+)(\d{3})/,"$1,$2");}
if(digits&&digits>0)
{var nFrac=val-nInt;nFrac=Math.floor(nFrac*Math.pow(10,digits));sFrac="."+SDigits(nFrac,digits);}
else
sFrac="";return sInt+sFrac;},SDigits:function(val,c,fSign)
{var s="";var fNeg=(val<0);if(c==undefined)
c=0;if(fNeg)
val=-val;val=Math.floor(val);for(;c>0;c--)
{s=(val%10)+s;val=Math.floor(val/10);}
if(fSign||fNeg)
s=(fNeg?"-":"+")+s;return s;},EscapeHTML:function(s)
{s=s.toString();s=s.replace(/&/g,'&amp;');s=s.replace(/</g,'&lt;');s=s.replace(/>/g,'&gt;');s=s.replace(/\"/g,'&quot;');s=s.replace(/'/g,'&#39;');return s;},ReplaceKeys:function(st,keys)
{for(var key in keys)
st=st.StReplace("{"+key+"}",keys[key]);st=st.replace(/\{[^\{\}]*\}/g,"");return st;}})
String.prototype.Trim=function()
{return(this||"").replace(/^\s+|\s+$/g,"");};String.prototype.StReplace=function(stPat,stRep)
{var st="";if(stRep==undefined)
stRep="";else
stRep=stRep.toString();var ich=0;var ichFind=this.indexOf(stPat,0);while(ichFind>=0)
{st+=this.substring(ich,ichFind)+stRep;ich=ichFind+stPat.length;ichFind=this.indexOf(stPat,ich);}
st+=this.substring(ich);return st;};});
/* Begin file: dateutil.js */
global_namespace.define('startpad.date-util',function(NS){var Base=NS.import('startpad.base');var Format=NS.import('startpad.format-util');NS.ISO={tz:-(new Date().getTimezoneOffset())/60,enumMatch:new Base.Enum([1,"YYYY","MM","DD",5,"hh","mm",8,"ss",10,"sss","tz"]),FromDate:function(dt,fTime)
{var dtT=new Date();dtT.setTime(dt.getTime());var tz=dt.__tz;if(tz==undefined)
tz=NS.ISO.tz;if(tz)
dtT.setTime(dtT.getTime()+60*60*1000*tz);var s=dtT.getUTCFullYear()+"-"+Format.SDigits(dtT.getUTCMonth()+1,2)+"-"+Format.SDigits(dtT.getUTCDate(),2);var ms=dtT%(24*60*60*1000);if(ms||fTime||tz!=0)
{s+="T"+Format.SDigits(dtT.getUTCHours(),2)+":"+Format.SDigits(dtT.getUTCMinutes(),2);ms=ms%(60*1000);if(ms)
s+=":"+Format.SDigits(dtT.getUTCSeconds(),2);if(ms%1000)
s+="."+Format.SDigits(dtT.getUTCMilliseconds(),3);if(tz==0)
s+="Z";else
s+=Format.SDigits(tz,2,true);}
return s;},ToDate:function(sISO,objExtra)
{var e=NS.ISO.enumMatch;var aParts=sISO.match(/^(\d{4})-?(\d\d)-?(\d\d)(T(\d\d):?(\d\d):?((\d\d)(\.(\d{0,6}))?)?(Z|[\+-]\d\d))?$/);if(!aParts)
return undefined;aParts[e.mm]=aParts[e.mm]||0;aParts[e.ss]=aParts[e.ss]||0;aParts[e.sss]=aParts[e.sss]||0;aParts[e.sss]=Math.round(+('0.'+aParts[e.sss])*1000);if(!aParts[e.tz]||aParts[e.tz]==="Z")
aParts[e.tz]=0;else
aParts[e.tz]=parseInt(aParts[e.tz]);if(aParts[e.MM]>59||aParts[e.DD]>31||aParts[e.hh]>23||aParts[e.mm]>59||aParts[e.ss]>59||aParts[e.tz]<-23||aParts[e.tz]>23)
return undefined;var dt=new Date();dt.setUTCFullYear(aParts[e.YYYY],aParts[e.MM]-1,aParts[e.DD]);if(aParts[e.hh])
{dt.setUTCHours(aParts[e.hh],aParts[e.mm],aParts[e.ss],aParts[e.sss]);}
else
dt.setUTCHours(0,0,0,0);dt.__tz=aParts[e.tz];if(aParts[e.tz])
dt.setTime(dt.getTime()-dt.__tz*(60*60*1000));if(objExtra)
NS.Extend(dt,objExtra);return dt;}};});
/* Begin file: data.js */
global_namespace.define('startpad.data',function(NS){var DateUtil=NS.import('startpad.date-util');var Timer=NS.import('startpad.timer');var JSON=NS.import('JSON');var Base=NS.import('startpad.base');var Event=NS.import('startpad.events');var Format=NS.import('startpad.format-util');NS.extend(NS,{sSiteName:"web",apikey:undefined,sid:undefined,afn:[],ifn:1,mMessages:{errBusy:"Call made while another call is in progress.",},SetSiteName:function(sName)
{NS.sSiteName=sName;},GetAPIKey:function(sDomain,fnNext)
{if(NS.apikey!=undefined)
return fnNext();new NS.ScriptData("http://"+sDomain+"/init.json").Call({},function(obj)
{if(obj.status!="OK")
{alert(obj.message);return;}
NS.apikey=obj.apikey;NS.sid=obj.sid;fnNext();});},StParams:function(obj)
{if(obj===undefined||obj===null)
{return"";}
var stDelim="?";var stParams="";for(var prop in obj)
{var sVal;if(!obj.hasOwnProperty(prop)||obj[prop]===undefined||obj[prop]==null)
continue;stParams+=stDelim;stParams+=encodeURIComponent(prop);if(typeof obj[prop]=="object")
{if(obj[prop].constructor===Date)
sVal=DateUtil.ISO.FromDate(obj[prop]);else
sVal=JSON.stringify(obj[prop]);}
else
sVal=obj[prop].toString();stParams+="="+encodeURIComponent(sVal);stDelim="&";}
if(obj._anchor)
{stParams+="#"+encodeURIComponent(obj._anchor);}
return stParams;},ParseParams:function(stURL)
{var rgQuery=stURL.match(/([^?#]*)(#.*)?$/);if(!rgQuery)
{return{};}
var objParse={};if(rgQuery[2])
{objParse._anchor=decodeURIComponent(rgQuery[2].substring(1));}
var rgParams=rgQuery[1].split("&");for(var i=0;i<rgParams.length;i++)
{var ich=rgParams[i].indexOf("=");var stName;var stValue;if(ich===-1)
{stName=rgParams[i];stValue="";continue;}
else
{stName=rgParams[i].substring(0,ich);stValue=rgParams[i].substring(ich+1);}
objParse[decodeURIComponent(stName)]=decodeURIComponent(stValue);}
return objParse;}});NS.ScriptData=function(stURL,fnCallback)
{this.stURL=stURL;this.fnCallback=fnCallback;this.rid=0;this.fInCall=false;this.Activate();return this;};NS.ScriptData.prototype={constructor:NS.ScriptData,rid:0,msTimeout:10000,cchMax:1000,Activate:function()
{if(this.rid!=0)
return;this.rid=NS.ifn++;NS.afn[this.rid]=this;},Call:function(objParams,fnCallback)
{this.Activate();if(this.fInCall)
throw(new Error(NS.mMessages.errBusy));this.fInCall=true;Base.ExtendMissing(objParams,{apikey:NS.apikey});if(fnCallback)
this.fnCallback=fnCallback;if(objParams===undefined)
objParams={};objParams.callback=this.CallbackName();this.script=document.createElement('script');this.script.src=this.stURL+NS.StParams(objParams);if(this.script.src.length>this.cchMax)
{var pd=new NS.PostData(this.stURL,this.fnCallback);pd.Call(objParams);this.Cancel();return;}
this.tm=new Timer.Timer(this.msTimeout,this.Timeout.FnMethod(this)).Active(true);this.dCall=new Date();document.body.appendChild(this.script);console.info("script["+this.rid+"]: "+this.script.src);return this;},CallbackName:function()
{return NS.SGlobalName("afn")+"["+this.rid+"].Callback"},Callback:function()
{var rid=this.rid;this.Cancel();console.info("("+rid+") -> ",arguments);if(this.fnCallback)
this.fnCallback.apply(undefined,arguments);},Timeout:function()
{var rid=this.rid;console.info("("+rid+") -> TIMEOUT");this.Cancel();if(this.fnCallback)
this.fnCallback({status:"Fail/Timeout",message:"The "+NS.sSiteName+" server failed to respond."});},Cancel:function()
{NS.ScriptData.Cancel(this.rid);}};NS.ScriptData.Cancel=function(rid)
{if(rid==0)
return;var sd=NS.afn[rid];NS.afn[rid]=undefined;if(sd&&sd.rid==rid)
{sd.rid=0;sd.fInCall=false;if(sd.tm)
sd.tm.Active(false);}};NS.PostData=function(stURL,fnCallback)
{this.stURL=stURL;this.fnCallback=fnCallback;return this;}
NS.PostData.prototype={constructor:NS.PostData,msTimeout:10000,Call:function(objParams,fnCallback)
{if(fnCallback)
this.fnCallback=fnCallback;Base.ExtendMissing(objParams,{apikey:NS.apikey});var reDomain=/^http:\/\/[^\/]+/;var sDomain='';var aDomain=reDomain.exec(this.stURL);if(aDomain!=null)
sDomain=aDomain[0];var sGetResult=sDomain+'/get-result.json';this.sd=new NS.ScriptData(sGetResult,this.fnCallback);if(objParams===undefined)
objParams={};objParams.rid=this.sd.rid;objParams.sid=NS.sid;objParams.callback=this.sd.CallbackName();this.iframe=document.createElement("iframe");this.iframe.style.width="0px";this.iframe.style.height="0px";this.iframe.style.border="0px";document.body.appendChild(this.iframe);this.doc=this.iframe.contentDocument||this.iframe.contentWindow.document;console.info("post["+this.sd.rid+"]: "+this.stURL);var stb=new Base.StBuf();stb.Append("<html><body><form name=\"PostData\" action=\""+this.stURL+"\" method=\"post\">");for(prop in objParams)
{var sValue;if(!objParams.hasOwnProperty(prop))
continue;stb.Append("<input type=\"text\" name=\""+prop+"\" value='");if(typeof objParams[prop]=='object')
{if(objParams[prop].constructor===Date)
sValue=DateUtil.ISO.FromDate(objParams[prop]);else
sValue=JSON.stringify(objParams[prop]);}
else
{sValue=Format.EscapeHTML(objParams[prop]);}
stb.Append(sValue);stb.Append("'>");console.info("    "+prop+": "+sValue);}
stb.Append("</input></form></body></html>");Event.AddEventFn(this.iframe,"load",this.Loaded.FnMethod(this).FnArgs(this.rid));this.doc.write(stb.toString());this.tm=new Timer.Timer(this.msTimeout,this.Timeout.FnMethod(this)).Active(true);this.msCallStart=new Date().getTime();this.doc.PostData.submit();},Loaded:function(evt)
{this.tm.Active(false);this.msResponse=new Date().getTime()-this.msCallStart;console.info("("+this.sd.rid+") -> POST COMPLETE "+this.msResponse+" ms");this.sd.Call({sid:NS.sid,ridPost:this.sd.rid});},Timeout:function()
{this.sd.Timeout();},Cancel:function()
{this.sd.Cancel();this.tm.Active(false)}};});
