"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[394],{3905:(e,t,r)=>{r.d(t,{Zo:()=>l,kt:()=>h});var n=r(7294);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var p=n.createContext({}),c=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},l=function(e){var t=c(e.components);return n.createElement(p.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,a=e.originalType,p=e.parentName,l=s(e,["components","mdxType","originalType","parentName"]),u=c(r),m=o,h=u["".concat(p,".").concat(m)]||u[m]||d[m]||a;return r?n.createElement(h,i(i({ref:t},l),{},{components:r})):n.createElement(h,i({ref:t},l))}));function h(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=r.length,i=new Array(a);i[0]=m;var s={};for(var p in t)hasOwnProperty.call(t,p)&&(s[p]=t[p]);s.originalType=e,s[u]="string"==typeof e?e:o,i[1]=s;for(var c=2;c<a;c++)i[c]=r[c];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},7170:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>d,frontMatter:()=>a,metadata:()=>s,toc:()=>c});var n=r(7462),o=(r(7294),r(3905));const a={slug:"/",sidebar_position:1},i="Introduction",s={unversionedId:"Introduction",id:"Introduction",title:"Introduction",description:"The Participatory System Mapper (PRSM for short) is a web app that makes it easy for a group of people working together to draw networks (or 'maps') of systems.",source:"@site/docs/Introduction.md",sourceDirName:".",slug:"/",permalink:"/",draft:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{slug:"/",sidebar_position:1},sidebar:"tutorialSidebar",next:{title:"Examples",permalink:"/Examples"}},p={},c=[{value:"Maps",id:"maps",level:2},{value:"Systems",id:"systems",level:2},{value:"Participatory system mapping",id:"participatory-system-mapping",level:2}],l={toc:c},u="wrapper";function d(e){let{components:t,...a}=e;return(0,o.kt)(u,(0,n.Z)({},l,a,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"introduction"},"Introduction"),(0,o.kt)("p",null,"The Participatory System Mapper (PRSM for short) is a web app that makes it easy for a group of people working together to draw networks (or 'maps') of systems.  "),(0,o.kt)("p",null,(0,o.kt)("img",{alt:"Example map: Some factors causing loss of biodiversity",src:r(6395).Z,width:"698",height:"332"})),(0,o.kt)("h2",{id:"maps"},"Maps"),(0,o.kt)("p",null,"The network or map can be anything that has items (or 'factors' or 'nodes') connected by links (or 'edges').  Here are some examples:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"People (the nodes) connected by knowing each other"),(0,o.kt)("li",{parentName:"ul"},"Factors or variables causing (the links) changes in other factors"),(0,o.kt)("li",{parentName:"ul"},"Switches connected by wires"),(0,o.kt)("li",{parentName:"ul"},"Computers connected by network links"),(0,o.kt)("li",{parentName:"ul"},"Theories expressed as variables and relationships between them"),(0,o.kt)("li",{parentName:"ul"},"Company boards of directors (the nodes) and the directors that sit on more than one board (the links)"),(0,o.kt)("li",{parentName:"ul"},"Twitter hashtags (the nodes) included together on posts (the links)"),(0,o.kt)("li",{parentName:"ul"},"Scientists (the nodes) co-authoring papers (the links)"),(0,o.kt)("li",{parentName:"ul"},"and so on.")),(0,o.kt)("h2",{id:"systems"},"Systems"),(0,o.kt)("p",null,"The software is aimed at people who are interested in understanding whole systems.  ",(0,o.kt)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/System"},"Wikipedia"),' defines a system as "a group of interacting or interrelated entities that form a unified whole".'),(0,o.kt)("h2",{id:"participatory-system-mapping"},"Participatory system mapping"),(0,o.kt)("p",null,"The app is designed to enable groups of people, each using their own computer (or tablet) to collaborate in the drawing of a map.  They may be sitting around a table, discussing the map as it is created face to face, or working remotely, using video conferencing or the chat feature that is built into the app.  Everyone can participate because every edit (creating nodes and links, arranging them and so on) is broadcast to all the other participants as the changes are made (just as Google Docs does for text, for example).  "),(0,o.kt)("p",null,"When you start the app in your browser, a 'room' is created for you in which to draw your network.  You can add other users to this room to share the work.  Only those with access to the room can see what is being created."))}d.isMDXComponent=!0},6395:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/biodiversityImproved-aec0bb09759ce2468aaebc4aea013253.webp"}}]);