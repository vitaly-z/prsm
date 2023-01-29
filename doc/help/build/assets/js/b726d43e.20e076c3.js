"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[557],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>h});var o=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);t&&(o=o.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,o)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function p(e,t){if(null==e)return{};var n,o,a=function(e,t){if(null==e)return{};var n,o,a={},r=Object.keys(e);for(o=0;o<r.length;o++)n=r[o],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(o=0;o<r.length;o++)n=r[o],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=o.createContext({}),s=function(e){var t=o.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},c=function(e){var t=s(e.components);return o.createElement(l.Provider,{value:t},e.children)},m="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return o.createElement(o.Fragment,{},t)}},u=o.forwardRef((function(e,t){var n=e.components,a=e.mdxType,r=e.originalType,l=e.parentName,c=p(e,["components","mdxType","originalType","parentName"]),m=s(n),u=a,h=m["".concat(l,".").concat(u)]||m[u]||d[u]||r;return n?o.createElement(h,i(i({ref:t},c),{},{components:n})):o.createElement(h,i({ref:t},c))}));function h(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var r=n.length,i=new Array(r);i[0]=u;var p={};for(var l in t)hasOwnProperty.call(t,l)&&(p[l]=t[l]);p.originalType=e,p[m]="string"==typeof e?e:a,i[1]=p;for(var s=2;s<r;s++)i[s]=n[s];return o.createElement.apply(null,i)}return o.createElement.apply(null,n)}u.displayName="MDXCreateElement"},273:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>m,frontMatter:()=>r,metadata:()=>p,toc:()=>s});var o=n(7462),a=(n(7294),n(3905));const r={sidebar_position:10},i="Running PRSM locally or on an intranet",p={unversionedId:"Advanced/RunningLocally",id:"Advanced/RunningLocally",title:"Running PRSM locally or on an intranet",description:"Some organisations would prefer to run PRSM entirely within their own intranet.  Sometimes it may be desirable to run PRSM just on one computer working offline.  For these cases, PRSM is also available in 'containerised' form, which makes it easy to install it on a local server on an intranet, or even on a laptop.  The server can be a Linux, Windows or Apple Mac machine. The following instructions assume that you have some experience with using the command line in a Terminal or Powershell.",source:"@site/docs/Advanced/RunningLocally.md",sourceDirName:"Advanced",slug:"/Advanced/RunningLocally",permalink:"/prsm/doc/help/Advanced/RunningLocally",draft:!1,tags:[],version:"current",sidebarPosition:10,frontMatter:{sidebar_position:10},sidebar:"tutorialSidebar",previous:{title:"Advanced",permalink:"/prsm/doc/help/category/advanced"},next:{title:"Extending PRSM",permalink:"/prsm/doc/help/Advanced/Extending"}},l={},s=[],c={toc:s};function m(e){let{components:t,...n}=e;return(0,a.kt)("wrapper",(0,o.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"running-prsm-locally-or-on-an-intranet"},"Running PRSM locally or on an intranet"),(0,a.kt)("p",null,"Some organisations would prefer to run PRSM entirely within their own intranet.  Sometimes it may be desirable to run PRSM just on one computer working offline.  For these cases, PRSM is also available in 'containerised' form, which makes it easy to install it on a local server on an intranet, or even on a laptop.  The server can be a Linux, Windows or Apple Mac machine. The following instructions assume that you have some experience with using the command line in a Terminal or Powershell."),(0,a.kt)("ol",null,(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"Check to see whether ",(0,a.kt)("inlineCode",{parentName:"p"},"python3")," is already installed, by typing ",(0,a.kt)("inlineCode",{parentName:"p"},"python3 --version")," at the command prompt.  If it responds with the version of the python installation, you can go on to the next step.  If you get an error message, you will need to install python, using ",(0,a.kt)("a",{parentName:"p",href:"https://www.python.org/downloads/"},"these instructions"),".")),(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"Install ",(0,a.kt)("inlineCode",{parentName:"p"},"podman")," using the instructions ",(0,a.kt)("a",{parentName:"p",href:"https://podman.io/getting-started/installation"},"here"),".")),(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"Install ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/containers/podman-compose"},"podman-compose")," using the command:",(0,a.kt)("br",{parentName:"p"}),"\n",(0,a.kt)("inlineCode",{parentName:"p"},"pip3 install podman-compose"))),(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"Create a blank, plain text file in a convenient directory and name it ",(0,a.kt)("inlineCode",{parentName:"p"},"compose.yaml"),". Use a text editor to copy the following into the file (be sure to use a text editor, not a word processor):  "),(0,a.kt)("pre",{parentName:"li"},(0,a.kt)("code",{parentName:"pre"},'services:\n  y-websocket:\n    image: docker.io/micrology/prsm-y-websocket\n    ports: \n      - "1234:1234"\n    restart: unless-stopped\n  htppd:\n    image: docker.io/micrology/prsm-httpd\n    ports:\n      - "8080:8080"\n    restart: unless-stopped\n'))),(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"Save the file and then run the command:",(0,a.kt)("br",{parentName:"p"}),"\n",(0,a.kt)("inlineCode",{parentName:"p"},"podman-compose up -d"),(0,a.kt)("br",{parentName:"p"}),"\n","in the same directory as the ",(0,a.kt)("inlineCode",{parentName:"p"},"compose.yaml")," file")),(0,a.kt)("li",{parentName:"ol"},(0,a.kt)("p",{parentName:"li"},"In a web browser,  on the same computer, enter ",(0,a.kt)("inlineCode",{parentName:"p"},"http://localhost:8080")," in the address bar.  You should see the PRSM welcome page (the same as at ",(0,a.kt)("a",{parentName:"p",href:"https://prsm.uk"},"https://prsm.uk"),").  Click on the 'Start now' button to get to a blank PRSM map.  This copy of PRSM is running entirely locally: you can disconnect the computer from the internet and it will still function.  "))),(0,a.kt)("p",null,"If the computer is on an intranet, it should be possible to access this local version of PRSM with a URL something like ",(0,a.kt)("a",{parentName:"p",href:"http://168.192.0.123:8080"},"http://168.192.0.123:8080"),", where the IP address is the local ",(0,a.kt)("em",{parentName:"p"},"intranet")," address of the server (or if it has one, you can use the local network name of the computer, followed by :8080 as the port number).  "),(0,a.kt)("admonition",{type:"tip"},(0,a.kt)("p",{parentName:"admonition"},"If the browser reports that the location is not found, check for access being blocked by a firewall.  A firewall needs to pass ports 8080 ",(0,a.kt)("em",{parentName:"p"},"and")," 1234.  These port numbers can be changed to any free numbers above 1000 by stopping the service (see below) and editing the ",(0,a.kt)("inlineCode",{parentName:"p"},"compose.yaml")," file to ",(0,a.kt)("inlineCode",{parentName:"p"},"xxxx:1234"),"and ",(0,a.kt)("inlineCode",{parentName:"p"},"yyyy:8080"),", substituting the new numbers for ",(0,a.kt)("inlineCode",{parentName:"p"},"xxxx")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"yyyy"),"."),(0,a.kt)("p",{parentName:"admonition"},"To stop the PRSM service, navigate to the directory with the ",(0,a.kt)("inlineCode",{parentName:"p"},"compose.yaml")," file and enter the command:",(0,a.kt)("br",{parentName:"p"}),"\n",(0,a.kt)("inlineCode",{parentName:"p"},"podman-compose down"))))}m.isMDXComponent=!0}}]);