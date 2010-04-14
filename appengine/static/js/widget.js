/* Begin file: namespace.js */
if(!window.console){(function(){var noop=function(){};var names=["log","debug","info","warn","error","assert","dir","dirxml","group","groupEnd","time","timeEnd","count","trace","profile","profileEnd"];window.console={};for(var i=0;i<names.length;++i){window.console[names[i]]=noop;}}());}
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
/* Begin file: widget-ui.js */
global_namespace.Define('pageslike.widget',function(NS){var Base=NS.Import('startpad.base');var DOM=NS.Import('startpad.DOM');var Event=NS.Import('startpad.events');var Format=NS.Import('startpad.format-util');var Data=NS.Import('startpad.data');NS.Extend(NS,{sSiteName:"PagesLike",mTestDomains:{'devserver':true,'localhost':true,'pageslike':true,'localhost:8080':true},sDomain:"www.pageslike.com",iWidget:0,aWidgets:[],optionsDefault:{community:'general'},fStyled:false,Init:function()
{if(window.location.host in NS.mTestDomains)
NS.sDomain=window.location.host;},InsertWidget:function(options)
{if(!NS.fStyled)
{var head=document.getElementsByTagName("head")[0];var link=document.createElement('link');link.type='text/css';link.rel='stylesheet';link.href='http://'+NS.sDomain+'/styles/widget.css';head.appendChild(link);NS.fStyled=true;}
return new Widget(options);},GetWidget:function(iWidget)
{var widget=NS.aWidgets[iWidget];widget.Update();return widget;},ScanPage:function(elemRoot)
{reHead=/^H[1-8]$/i;reTagClass=/\btag\b/i;reBookmarkClass=/\bbookmark\b/i;var aInfo=[];if(!elemRoot)
elemRoot=document;var aAnchors=elemRoot.getElementsByTagName('a');var aTags=[];var aBookmarks=[];for(var i=0;i<aAnchors.length;i++)
{var anchor=aAnchors[i];var sRel=anchor.getAttribute('rel');if(reTagClass.test(sRel))
aTags.push(anchor);if(reBookmarkClass(sRel))
aBookmarks.push(anchor);}
if(aBookmarks.length>0)
{for(var i=0;i<aBookmarks.length;i++)
{var bookmark=aBookmarks[i];var info={url:bookmark.href,tags:[]};aInfo.push(info);}
aTitles=DOM.GetElementsByTagClassName(elemRoot,"*","post-title");for(var i=0;i<aTitles.length;i++)
{var title=aTitles[i];var sTitle=DOM.GetText(title);var iBM=NS.ClosestAncestor(title,aBookmarks);aInfo[iBM].title=sTitle;}
for(var i=0;i<aTags.length;i++)
{var tag=aTags[i];var sTag=NS.TagFromElem(tag);if(sTag==undefined)
continue;var iBM=NS.ClosestAncestor(tag,aBookmarks);aInfo[iBM].tags.push(sTag);}}
if(aInfo.length==0)
{NS.ScanDOM(elemRoot,function(elem,iDepth){if(elem.tagName=='A'&&(reHead.test(elem.parentNode.tagName)||elem.parentNode.tagName=='P'&&elem.parentNode.className=='titlePost'))
{if(!elem.href)
return false;var info={url:elem.href,title:DOM.GetText(elem),tags:[]};aInfo.push(info);return false;}
if(aInfo.length>0&&elem.tagName=='A'&&(reTagClass.test(elem.getAttribute('rel'))||elem.parentNode.tagName=='P'&&elem.parentNode.className=='tags'))
{aInfo[aInfo.length-1].tags.push(NS.TagFromElem(elem))}
return false;});}
if(aInfo.length==0)
{var info={url:document.location.href,title:document.title,tags:NS.ExtractTags(aTags)};var aHeads=document.getElementsByTagName('h1');if(aHeads.length==1)
{var sTitle;sTitle=DOM.GetText(aHeads[0]);if(sTitle)
info.title=sTitle;}
aInfo.push(info);}
for(var i=0;i<aInfo.length;i++)
{Base.DeDupArray(aInfo[i].tags);}
return aInfo;},ClosestAncestor:function(elemChild,aUncles)
{var cBest;var iBest;for(var i=0;i<aUncles.length;i++)
{var c=DOM.CommonAncestorHeight(elemChild,aUncles[i]);if(cBest===undefined||c<cBest)
{iBest=i;cBest=c;}}
return iBest;},ScanDOM:function(elem,fn,iDepth)
{if(!elem)
elem=document;if(iDepth===undefined)
iDepth=0;if(elem.nodeType==1&&fn(elem,iDepth))
return true;var aChildren=elem.childNodes;for(var i=0;i<aChildren.length;i++)
{if(NS.ScanDOM(aChildren[i],fn,iDepth+1))
return true;}
return false;},ExtractTags:function(aTags)
{var aSTags=[];for(var i=0;i<aTags.length;i++)
{var tag=aTags[i];var sTag=NS.TagFromElem(tag);if(sTag==undefined)
continue;aSTags.push(sTag);}},TagFromElem:function(elem)
{var sTag=DOM.GetText(elem);if(!sTag)
return undefined;sTag=Format.Slugify(sTag);return sTag;}});function Widget(options)
{NS.aWidgets[this.iWidget=NS.iWidget++]=this;this.options=Base.ExtendMissing(options,NS.optionsDefault);this.options.iWidget=this.iWidget;this.Insert();if(!this.options.defer_load)
Event.AddEventFn(window,"load",this.Fill.FnMethod(this));}
NS.Extend(Widget.prototype,{sWidgetPattern:'<div class="pageslike override" id="pageslike_{iWidget}"><h4>Pages Like This</h4>Loading...</div>',sHeader:'<h4>Pages Like This</h4>',sTagsPattern:'<p class="tags">{tags}</p>',sLinksPattern:'<ul class="list">{links}</ul>',sLinkPattern:'<li {li_class}><a href="{url}">{title} ({score})</a></li>',sTagPattern:'<a href="http://{sDomain}/tag/{tag}">{tag}</a>',sFooter:'<p class="poweredby">Powered by <a href="http://{sDomain}/">{sSiteName}</a></p>',nLinksDisplayed:7,Insert:function()
{var sHTML=Format.ReplaceKeys(this.sWidgetPattern,this.options);if(this.elem)
this.elem.innerHTML=sHTML;else
document.write(sHTML);},Update:function()
{if(this.div==undefined)
this.div=document.getElementById("pageslike_"+this.iWidget);},Fill:function(evt,elemRoot,fnCallback)
{console.log("PagesLike - Loading widget: ",this);var aInfo=NS.ScanPage(elemRoot);var widget=this;widget.Update();Data.GetAPIKey(NS.sDomain,function(obj)
{var data=new Data.ScriptData("http://"+NS.sDomain+"/scan.json");data.Call(NS.Extend({links:aInfo},widget.options),function(obj)
{widget.scan=obj;var sHTML=new Base.StBuf();sHTML.Append(Format.ReplaceKeys(widget.sHeader,NS));if(obj.status!='OK')
{sHTML.Append(obj.message);}
else
{sTagList=new Base.StBuf();var sSep='';for(var i=0;i<obj.tags.length;i++)
{var tag=obj.tags[i];sTagList.Append(sSep+Format.ReplaceKeys(widget.sTagPattern,{sDomain:NS.sDomain,tag:tag}));sSep=', ';}
sHTML.Append(Format.ReplaceKeys(widget.sTagsPattern,{tags:sTagList}));sLinkList=new Base.StBuf();for(var i=0;i<obj.links.length;i++)
{var link=obj.links[i];if(i>widget.nLinksDisplayed)
NS.Extend(link,{li_class:'class="extra"'});sLinkList.Append(Format.ReplaceKeys(widget.sLinkPattern,link));}
sHTML.Append(Format.ReplaceKeys(widget.sLinksPattern,{links:sLinkList}));}
sHTML.Append(Format.ReplaceKeys(widget.sFooter,NS));widget.div.innerHTML=sHTML.toString();var links=widget.div.getElementsByTagName('li');var cVisible=0
for(i=0;i<links.length;i++)
{if(cVisible>=widget.nLinksDisplayed)
break;if(links[i].offsetHeight!=0)
{cVisible++;continue;}
if(links[i].className=='extra')
{links[i].className='';if(links[i].offsetHeight!=0)
cVisible++;}}
if(fnCallback)
fnCallback(obj);});});}});NS.Init();});
