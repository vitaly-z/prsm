"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[273],{3905:(e,t,r)=>{r.d(t,{Zo:()=>c,kt:()=>f});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function s(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var l=n.createContext({}),p=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):s(s({},t),e)),r},c=function(e){var t=p(e.components);return n.createElement(l.Provider,{value:t},e.children)},m="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,c=i(e,["components","mdxType","originalType","parentName"]),m=p(r),d=a,f=m["".concat(l,".").concat(d)]||m[d]||u[d]||o;return r?n.createElement(f,s(s({ref:t},c),{},{components:r})):n.createElement(f,s({ref:t},c))}));function f(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=r.length,s=new Array(o);s[0]=d;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i[m]="string"==typeof e?e:a,s[1]=i;for(var p=2;p<o;p++)s[p]=r[p];return n.createElement.apply(null,s)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},5304:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>s,default:()=>u,frontMatter:()=>o,metadata:()=>i,toc:()=>p});var n=r(7462),a=(r(7294),r(3905));const o={sidebar_position:2},s="Examples",i={unversionedId:"Examples",id:"Examples",title:"Examples",description:"Here are a few examples of what you can do with the app:",source:"@site/docs/Examples.md",sourceDirName:".",slug:"/Examples",permalink:"/prsm/doc/help/Examples",draft:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"tutorialSidebar",previous:{title:"Introduction",permalink:"/prsm/doc/help/"},next:{title:"Installation",permalink:"/prsm/doc/help/Installation"}},l={},p=[],c={toc:p},m="wrapper";function u(e){let{components:t,...o}=e;return(0,a.kt)(m,(0,n.Z)({},c,o,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"examples"},"Examples"),(0,a.kt)("p",null,"Here are a few examples of what you can do with the app:"),(0,a.kt)("p",null,"The first is a theory of change adapted from an ",(0,a.kt)("a",{parentName:"p",href:"https://www.thinknpc.org/resource-hub/ten-steps/"},"NPC report"),"."),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"NCP Example",src:r(5490).Z,width:"2950",height:"1856"})),(0,a.kt)("p",null,"The second is a system map about the environmental impact of goods transport developed by a small group of experts working together using the app."),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"SCandL Example",src:r(4019).Z,width:"2952",height:"1852"})),(0,a.kt)("p",null,"The third is a large network of 736 nodes and about 9000 links representing the team members playing in the 2019 football World Cup."),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"World Cup 2019 Example",src:r(4066).Z,width:"2952",height:"1786"})),(0,a.kt)("p",null,"The fourth is a map of the UK surface transport system focusing on Transport Decarbonisation, Air Quality and Health (see Penn, A. S., Bartington, S. E., Moller, S. J., Hamilton, I., Levine, J. G., Hatcher, K., & Gilbert, N. (2022). Adopting a Whole Systems Approach to Transport Decarbonisation, Air Quality and Health: An Online Participatory Systems Mapping Case Study in the UK. Atmosphere, 13(3), Article 3. ",(0,a.kt)("a",{parentName:"p",href:"https://doi.org/10.3390/atmos13030492"},"https://doi.org/10.3390/atmos13030492"),")"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"Transition full map",src:r(8375).Z,width:"10184",height:"6672"})),(0,a.kt)("p",null,"and an extract from that map showing the impications of changing the number of electric cars."),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"Downstream electric cars",src:r(8881).Z,width:"2538",height:"1884"})),(0,a.kt)("p",null,"This uses some of the PRSM ",(0,a.kt)("a",{parentName:"p",href:"Styling#analysis-tab"},"analysis")," and ",(0,a.kt)("a",{parentName:"p",href:"Styling#layout"},"layout")," functions: Show only factors 3 links from the selected factor; Show links downstream of the selected factor; and the Fan layout."))}u.isMDXComponent=!0},5490:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/NPCexample-3aab6ba1bf1f4a5434ecb638fb19b464.png"},4019:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/SCandLexample-24c8a3458a624b42bc332c07348e656d.png"},8881:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/TransitionDownstreamElectricCars-4ed7f9a87bb992704735f18c593710dd.png"},8375:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/TransitionFullMap-42dda7392736cb9b0024b611ca0d3fee.png"},4066:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/WorldCup2019example-3d940aa982ad70c41051ef9402862c00.png"}}]);