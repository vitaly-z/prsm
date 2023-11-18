"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[937],{3905:(e,t,a)=>{a.d(t,{Zo:()=>u,kt:()=>h});var n=a(7294);function r(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function o(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function i(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?o(Object(a),!0).forEach((function(t){r(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):o(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function s(e,t){if(null==e)return{};var a,n,r=function(e,t){if(null==e)return{};var a,n,r={},o=Object.keys(e);for(n=0;n<o.length;n++)a=o[n],t.indexOf(a)>=0||(r[a]=e[a]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)a=o[n],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(r[a]=e[a])}return r}var l=n.createContext({}),p=function(e){var t=n.useContext(l),a=t;return e&&(a="function"==typeof e?e(t):i(i({},t),e)),a},u=function(e){var t=p(e.components);return n.createElement(l.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var a=e.components,r=e.mdxType,o=e.originalType,l=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),c=p(a),m=r,h=c["".concat(l,".").concat(m)]||c[m]||d[m]||o;return a?n.createElement(h,i(i({ref:t},u),{},{components:a})):n.createElement(h,i({ref:t},u))}));function h(e,t){var a=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=a.length,i=new Array(o);i[0]=m;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[c]="string"==typeof e?e:r,i[1]=s;for(var p=2;p<o;p++)i[p]=a[p];return n.createElement.apply(null,i)}return n.createElement.apply(null,a)}m.displayName="MDXCreateElement"},9269:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>d,frontMatter:()=>o,metadata:()=>s,toc:()=>p});var n=a(7462),r=(a(7294),a(3905));const o={sidebar_position:13},i="Release Notes",s={unversionedId:"ReleaseNotes",id:"ReleaseNotes",title:"Release Notes",description:"2.1",source:"@site/docs/ReleaseNotes.md",sourceDirName:".",slug:"/ReleaseNotes",permalink:"/ReleaseNotes",draft:!1,tags:[],version:"current",sidebarPosition:13,frontMatter:{sidebar_position:13},sidebar:"tutorialSidebar",previous:{title:"Acknowledgements",permalink:"/Acknowledgements"}},l={},p=[{value:"2.1",id:"21",level:2},{value:"2.0",id:"20",level:2},{value:"New features",id:"new-features",level:3},{value:"Improvements",id:"improvements",level:3},{value:"Resolved issues",id:"resolved-issues",level:3}],u={toc:p},c="wrapper";function d(e){let{components:t,...a}=e;return(0,r.kt)(c,(0,n.Z)({},u,a,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"release-notes"},"Release Notes"),(0,r.kt)("h2",{id:"21"},"2.1"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"There is now a panel into which you can write a description or notes about the map as a whole.  To view the panel, click on the small grey button on the left edge of the map area.  While entering or editing text, you can use the formatting buttons at the top of the panel: bold, italic, underline, as well as change font size, insert images etc.  The contents of the panel are shared with other participants as you write. Click on the grey button again to put the panel away."),(0,r.kt)("li",{parentName:"ul"},"Instead of some factors and links being hidden when using the Analysis features, they are faded out, to provide more context around those that are shown.")),(0,r.kt)("h2",{id:"20"},"2.0"),(0,r.kt)("p",null,"Comparing version 2.0.x with version 1.9.0:"),(0,r.kt)("h3",{id:"new-features"},"New features"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Factors can be voted on (see Setting, Network, Show Reactions)."),(0,r.kt)("li",{parentName:"ul"},"Data from Excel spreadsheets can be imported and the data in maps can be exported to Excel."),(0,r.kt)("li",{parentName:"ul"},"Notes attached to factors and links can now be edited in a separate window, which can be much larger than the existing Notes panel and offers a wider range of editing commands."),(0,r.kt)("li",{parentName:"ul"},"Right clicking on a user's avatar (the initials in a circle at the top left of the map) selects all the factors and links that that user has created or modified."),(0,r.kt)("li",{parentName:"ul"},"Networks in ",(0,r.kt)("a",{parentName:"li",href:"https://en.wikipedia.org/wiki/DOT_(graph_description_language)"},"DOT or GV")," formatted files can be imported."),(0,r.kt)("li",{parentName:"ul"},"The log of a map's history can be copied to the clipboard and pasted into a wordprocessor or spreadsheet."),(0,r.kt)("li",{parentName:"ul"},"It is possible to run PRSM within an intranet, with no access needed to the wider internet, for use cases requiring the highest level of security.")),(0,r.kt)("h3",{id:"improvements"},"Improvements"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"The User Manual has been completely re-implemented and is now much easier to use."),(0,r.kt)("li",{parentName:"ul"},"The drawing layer behind the map now uses  'objects' which can be moved, resized, modified and deleted.  The logic for the drawing layer was completely re-implemented."),(0,r.kt)("li",{parentName:"ul"},"PRSM supports many more simulataneous users working together at the same time (at least 25), because of an improved way of handling updates to users' cursors."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},".prsm")," files,the native format for saving PRSM maps, are now compressed and much smaller than previously.  Older files can still be read."),(0,r.kt)("li",{parentName:"ul"},"Cloning maps is much faster."),(0,r.kt)("li",{parentName:"ul"},"Users can use trackpads on laptops instead of a mouse."),(0,r.kt)("li",{parentName:"ul"},"The Styles palette now offers more shapes for factors (ellipse, diamond,star, triangle, hexagon)."),(0,r.kt)("li",{parentName:"ul"},"Keyboard shortcuts have been added for Delete, Undo, and Redo.")),(0,r.kt)("h3",{id:"resolved-issues"},"Resolved issues"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Numerous optimisations and bug fixes."),(0,r.kt)("li",{parentName:"ul"},"Some minor changes to the appearance of the  interface to make PRSM easier and more intuitive to use.")))}d.isMDXComponent=!0}}]);