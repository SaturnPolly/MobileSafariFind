/* MobileSafariFind
 * Copyright 2010, Paul Styrnol
 * Released under MIT license:
 * http://github.com/SaturnPolly/MobileSafariFind/blob/master/MIT-LICENSE.txt
 */
(function(){
  var w=window,
      // CSS will be replaced by build script or by the testpage
      css='/*CSS*/',
      findbarElements=[
        '@prv">&#x25C0;',
        '@nfo">0/0',
        '@new">&#x2042;',
        '@clr">&#x25D1;',
        '@esc">&#x00D7;',
        '@nxt">&#x25B6;'
      ],
      prefix='__MSF__',
      matchElPrefix=prefix+'match',
      matchElPrefixCurrent=prefix+'match_current',
      doc=document,
      id=0,
      maxId=0,
      curPos=0,
      dark=false,
      slice=Array.prototype.slice,
      matches=[],
      matchCount=0,
      firstRun=!window.__MobileSafariFindbar,
      clickEvt=window.Touch?'touchstart':'click',
      webkit=navigator.userAgent.indexOf('AppleWebKit')>0,
      fb,
      scrollMonitor,
      orientationMonitor,
      reposition=false;
      
  // initialization
  if(firstRun) {
    fb = doc.createElement('div');
    fb.setAttribute('id', prefix + 'fb');
    fb.innerHTML = findbarElements.join('</span>').split('@').join('<span id="'+prefix)+'</span>';
    doc.body.appendChild(fb);
    
    var style = doc.createElement('style');
    style.textContent = css.replace(/;/g, ' !important;').replace(/@/g, prefix);
    doc.getElementsByTagName('head')[0].appendChild(style);
    
    w.__MobileSafariFindbar=true;
  } else {
    fb=$(prefix + 'fb');
    fb.style.display = 'block';
  }
  var fbPrevious = $(prefix + 'prv'), fbInfo = $(prefix + 'nfo'), fbNew = $(prefix + 'new'), 
    fbColors = $(prefix + 'clr'), fbEscape = $(prefix + 'esc'), fbNext = $(prefix + 'nxt');
  var controls=[
    [fbPrevious,  navCallback(previousId)],
    [fbNew,       newSearch],
    [fbColors,    colors],
    [fbEscape,    escape],
    [fbNext,      navCallback(nextId)]
  ];
  controls.forEach(function(pair) {
    pair[0].addEventListener(clickEvt, pair[1], true);
  });

  // screen management
  var physicalWidth=320,
      findbarYOffset=370,
      lastWidth=w.innerWidth,
      lastHeight=w.innerHeight,
      lastX=w.scrollX,
      lastY=w.scrollY,
      fbStyle=fb.style;
  w.addEventListener('orientationchange', orientationMonitor=function() {
    if(w.orientation===0) {
      physicalWidth=320;
      findbarYOffset=370;
    } else {
      physicalWidth=480;
      findbarYOffset=220;
    }
  });
  window.fb=fb;
  w.setInterval(scrollMonitor=function() {
    var win=w,
        width=win.innerWidth,
        height=win.innerHeight,
        x=win.scrollX,
        y=win.scrollY,
        factor=width/physicalWidth,
        deltaWidth=lastWidth-width,
        deltaHeight=lastHeight-height,
        deltaX=lastX-x,
        deltaY=lastY-y,
        fbStyle=fb.style;
    if(reposition || deltaWidth || deltaHeight || deltaX || deltaY) {
      reposition=false;
      fbStyle.fontSize=parseInt(24*factor)+'px';
      fbStyle.left=parseInt(x+(width/2)-(fb.offsetWidth/2))+'px';
      // for the first 60px to scroll window.scrollY stays 0 and the title and
      // url bar just move up
      fbStyle.top=parseInt(y>0?y+(findbarYOffset*factor):height-(44*factor))+'px';
      fb.style=fbStyle;
    }
    lastWidth=width;
    lastHeight=height;
    lastX=x;
    lastY=y;
  }, 50);
  
  // we're done initializing, time to search  
  newSearch();
  
  // findbar callbacks
  function navCallback(idFn) {
    return function(e) {
      stopEvent(e);
      if(matchCount<2) {
        return;
      }
      var d=document;
      var i=idFn();
      var o=matches[i[0]];
      var n=matches[i[1]];
      d.location.hash='';
      d.location.hash=matchElPrefix+i[1];
      fbInfo.innerHTML=(i[1]+1)+'/'+(matchCount);
      for (var i = 0; i < o.length; i++) {
        removeClass(matchElPrefixCurrent, o[i]);
      }
      for (var i = 0; i < n.length; i++) {
        addClass(matchElPrefixCurrent, n[i]);
      }
    }
  }  
  function escape(keepFindbar) {
    stopEvent(keepFindbar);
    // when the bookmarklet is loaded more than once the callbacks would still 
    // have access to the variables within the closures. removing and re-adding
    // them is much easier than handling that.
    controls.forEach(function(pair) {
      pair[0].removeEventListener(clickEvt, pair[1]);
    });
      
    // remove all markers
    var els=slice.call($$('span.'+matchElPrefix));
    for(var i=0,l=els.length;i<l;i++) {
      var el=els[i];
      var elp=el.parentNode;
      var c=slice.call(el.childNodes);
      for(var j=0, cl=c.length; j<cl; j++) {
        elp.insertBefore(c[j], el);
      }
      elp.removeChild(el);
    }
    if(true!==keepFindbar) {
      fb.style.display='none';
      w.removeEventListener('orientationchange', orientationMonitor);
      w.clearInterval(scrollMonitor);
    }
  }
  function colors(e) {
    stopEvent(e);
    if(!dark) {
      addClass(prefix+'inverted_colors', doc.body);
      dark=true;
    } else {
      removeClass(prefix+'inverted_colors', doc.body);
      dark=false;
    }    
  }
  function newSearch(e) {
    stopEvent(e);
    var searchTerm=window.prompt('Search for:');
    // keep old results if user cancels or fires an empty search
    if(searchTerm===null) {
      return;
    }
    
    id=0;
    maxId=0;
    curPos=0;
    matches=[];
    matchCount=0;
    escape(true);
    var ignoreShitLoadOfResults=false;
    var s=getSelection();
    s.removeAllRanges();
    while(find(searchTerm)) {
      // if we get that many results chances are we are stuck in an endless loop.
      // even if not, that many results are pretty useless. defensively abort.
      if(matches.length>99 && !ignoreShitLoadOfResults) {
        if(true===confirm('Found 100 results so far, hit "Cancel" if you want to abort.')) {
          ignoreShitLoadOfResults=true;
        } else {
          break;
        } 
      }
      
      var matchSet=[];
      var r=s.getRangeAt(0);
      
      var anchor=s.anchorNode;
      var focus=s.focusNode;
      
      if(anchor.parentNode.className.indexOf('__MSF__match')>-1) {
        alert('You just found a bug I wasn\'t able to reproduce in a long time. :) Please tell me how: mail@saturnpolly.net');
      }
      
      var m=marker(true);
      try {
        r.surroundContents(m);
        matchSet.push(m);
        // kickoff another search because the next node safari will find is the
        // one we just created, resulting in an endless loop and zero fun
        if(anchor===focus && webkit) {
          find(searchTerm);
        }        
      } catch(e) {
        if(e instanceof RangeException) {
          var commonParent=r.commonAncestorContainer;
          var startParent=anchor;
          while(startParent.parentNode!==commonParent) {
            startParent=startParent.parentNode;
          }
          var endParent=focus;
          while(endParent.parentNode!==commonParent) {
            endParent=endParent.parentNode;
          }
          var wrapables=siblingsBetween(startParent, endParent);
          // looking for Node.DOCUMENT_POSITION_FOLLOWING (right hand side), so search backwards  
          wrapables=wrapables.concat(getWrapablesWithinParent(anchor, startParent, 4, function(a) {a.reverse();}));
          // looking for Node.DOCUMENT_POSITION_PRECEDING
          wrapables=wrapables.concat(getWrapablesWithinParent(focus, endParent, 2, function() {}));
          for(var i=0, l=wrapables.length;i<l;i++) {
            matchSet.push(wrapInMarker([wrapables[i]]));
          }
          matchSet.push(wrapPartial(anchor, s.anchorOffset, m));
          matchSet.push(wrapPartial(focus, s.focusOffset));
        }
      }
      matches.push(matchSet);
    }
    
    s.removeAllRanges();
    matchCount=matches.length;
    reposition=true;
    if(matchCount>0) {
      fbInfo.innerHTML='1/'+matchCount;
      doc.location.hash='';
      doc.location.hash=matchElPrefix+'0';
    } else {
      fbInfo.innerHTML='&#x2639;';
    }
  }
  
  
  // wrapping/markers
  function marker(newMatch) {
    var m=document.createElement('span');
    m.setAttribute('class', id==0?matchElPrefix+' '+matchElPrefixCurrent:matchElPrefix);
    if(newMatch===true) {
      m.setAttribute('id', matchElPrefix+id++);
    }
    return m;
  }  
  function wrapInMarker(el) {
    if(!el[0]) {
      return;      
    }
    var m=marker();
    var p=el[0].parentNode;
    p.insertBefore(m, el[0]);
    for(var i in el) {
      m.appendChild(el[i]);
    }
    return m;
  }  
  function wrapPartial(node, offset, startMarker) {
    var m=startMarker?startMarker:marker();
    if(startMarker) {
      var part=node.textContent.substr(offset, node.length);
      m.appendChild(document.createTextNode(part));
      node.textContent=node.textContent.substr(0, offset);
      var nSib=node.nextSibling;
      if(nSib) {
        node.parentNode.insertBefore(m, nSib);
      } else {
        node.parentNode.appendChild(m);
      }
    } else {
      var part=node.textContent.substr(0, offset);
      m.appendChild(document.createTextNode(part));
      node.textContent=node.textContent.substr(offset);
      node.parentNode.insertBefore(m, node);      
    }
    return m;
  }  
  function getWrapablesWithinParent(node, parent, type, arrayFn) {
    var list=[];
    function r(children) {
      arrayFn(children);
      for(var i=0, l=children.length;i<l;i++) {
        var relation=node.compareDocumentPosition(children[i]);
        if(relation==type) {
          list.push(children[i]);
        } else if(relation==10) {
          // Node.DOCUMENT_POSITION_CONTAINED_BY
          r(slice.call(children[i].childNodes || []));
        } else {
          break;
        }
      }
    };
    r(slice.call(parent.childNodes));
    return list;
  }
  
  // helpers
  function $(s)               {return doc.getElementById(s);}
  function $$(s)              {return doc.querySelectorAll(s);}  
  function removeClass(c, el) {el.className=el.className.split(c).join('');}
  function addClass(c, el)    {el.className+=' '+c;}
  function nextId()           {return [curPos, curPos=curPos==matchCount-1?0:curPos+1];}
  function previousId()       {return [curPos, curPos=curPos==0?matchCount-1:curPos-1];}
  function stopEvent(e)       {if(typeof e==='object'){e.preventDefault();e.stopPropagation();}}
  function siblingsBetween(a,b) {  
    var sib=[];  
    var next = a.nextSibling; 
    while(next && next!=b){ 
      sib.push(next); 
      next=next.nextSibling; 
    }  
    return sib;  
  }  
})();