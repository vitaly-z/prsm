"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[302],{3905:(e,t,o)=>{o.d(t,{Zo:()=>h,kt:()=>g});var n=o(7294);function r(e,t,o){return t in e?Object.defineProperty(e,t,{value:o,enumerable:!0,configurable:!0,writable:!0}):e[t]=o,e}function a(e,t){var o=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),o.push.apply(o,n)}return o}function i(e){for(var t=1;t<arguments.length;t++){var o=null!=arguments[t]?arguments[t]:{};t%2?a(Object(o),!0).forEach((function(t){r(e,t,o[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(o)):a(Object(o)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(o,t))}))}return e}function l(e,t){if(null==e)return{};var o,n,r=function(e,t){if(null==e)return{};var o,n,r={},a=Object.keys(e);for(n=0;n<a.length;n++)o=a[n],t.indexOf(o)>=0||(r[o]=e[o]);return r}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)o=a[n],t.indexOf(o)>=0||Object.prototype.propertyIsEnumerable.call(e,o)&&(r[o]=e[o])}return r}var s=n.createContext({}),c=function(e){var t=n.useContext(s),o=t;return e&&(o="function"==typeof e?e(t):i(i({},t),e)),o},h=function(e){var t=c(e.components);return n.createElement(s.Provider,{value:t},e.children)},A="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var o=e.components,r=e.mdxType,a=e.originalType,s=e.parentName,h=l(e,["components","mdxType","originalType","parentName"]),A=c(o),d=r,g=A["".concat(s,".").concat(d)]||A[d]||u[d]||a;return o?n.createElement(g,i(i({ref:t},h),{},{components:o})):n.createElement(g,i({ref:t},h))}));function g(e,t){var o=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var a=o.length,i=new Array(a);i[0]=d;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l[A]="string"==typeof e?e:r,i[1]=l;for(var c=2;c<a;c++)i[c]=o[c];return n.createElement.apply(null,i)}return n.createElement.apply(null,o)}d.displayName="MDXCreateElement"},1935:(e,t,o)=>{o.r(t),o.d(t,{assets:()=>s,contentTitle:()=>i,default:()=>A,frontMatter:()=>a,metadata:()=>l,toc:()=>c});var n=o(7462),r=(o(7294),o(3905));const a={sidebar_position:7},i="Drawing Mode",l={unversionedId:"Drawing",id:"Drawing",title:"Drawing Mode",description:"Switching 'Switch drawing layer' ON reveals a group of buttons on the left that enables you to draw shapes, write text, and import images onto the network background.",source:"@site/docs/Drawing.md",sourceDirName:".",slug:"/Drawing",permalink:"/prsm/doc/help/Drawing",draft:!1,tags:[],version:"current",sidebarPosition:7,frontMatter:{sidebar_position:7},sidebar:"tutorialSidebar",previous:{title:"Styling the map",permalink:"/prsm/doc/help/Styling"},next:{title:"Data View",permalink:"/prsm/doc/help/DataView"}},s={},c=[{value:"Moving and modifying objects",id:"moving-and-modifying-objects",level:2},{value:"The drawing tools",id:"the-drawing-tools",level:2},{value:"Grouping objects",id:"grouping-objects",level:2}],h={toc:c};function A(e){let{components:t,...a}=e;return(0,r.kt)("wrapper",(0,n.Z)({},h,a,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"drawing-mode"},"Drawing Mode"),(0,r.kt)("p",null,"Switching 'Switch drawing layer' ON reveals a group of buttons on the left that enables you to draw shapes, write text, and import images onto the network background.  "),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Drawing layer",src:o(7203).Z,width:"2446",height:"1554"})),(0,r.kt)("p",null,"In drawing mode, the background has a faint square grid to help you line up your drawing.  The zoom slider at the bottom left of the window can be used to zoom in and out.  Double clicking on the background sets the zoom level to 1."),(0,r.kt)("p",null,"When you click on some of the drawing buttons, a small dialog box appears that can be used to adjust the drawing tool. For instance, the Line tool, which draws straight lines, has options for the line thickness, line colour and a couple more."),(0,r.kt)("p",null,"To stop using a tool, either click on another one, or click a second time on that tool's button."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Drawing layer samples",src:o(2081).Z,width:"2446",height:"1554"})),(0,r.kt)("p",null,"Above the column of buttons is a rectangle outline.  This is a 'handle' for the buttons.  Dragging the handle moves all the buttons together to a new spot in the window - useful if you want to draw where the buttons were."),(0,r.kt)("h2",{id:"moving-and-modifying-objects"},"Moving and modifying objects"),(0,r.kt)("p",null,"Once you have drawn an object (a straight line, or a rectangle, circle, freeform line or marker line), you can select it by clicking on it. The cursor will change to a cross.  Using the mouse (or a stylus or finger), you can  move the object around. To aid in aligning objects, when a side or end is just above or below or to the left or right of another object, red dotted guide lines will appear and the object will momentarily 'stick' on the alignment.  For a finer control of the position, use the arrow keys on the keyboard (up, down, left and right)."),(0,r.kt)("img",{src:o(6978).Z,width:"400"}),(0,r.kt)("p",null,"Click on the background to deselect the object.  "),(0,r.kt)("p",null,"Once an object has been selected, you can change its shape or orientation, and its colour and other characteristics. To change the fill or border colours, click in the corresponding colour well and choose a new colour.  'White' in the colour well is rendered as transparent, i.e. you will be able to see through the shape.  To get a non-transparent white shape, choose a shade very slighly different from white.  Coloured shapes are shown as slightly translucent, so that you can see the factors and links on the map behind them.  When you exit from drawing mode, the shapes will get their full colours and the network will appear in front of the shapes."),(0,r.kt)("p",null,"Drag one of the small blue dots (control points) to change an object's height or width.  Drag the dot above the object to the left or right to rotate it."),(0,r.kt)("h2",{id:"the-drawing-tools"},"The drawing tools"),(0,r.kt)("p",null,"The drawing tools are, in order from top to bottom:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Line")," draws straight lines.  There are options for the line width, the colour of the line, whether it is solid or dashed, and whether the line can be at any angle or must be either exactly horizontal or vertical.  To use the tool, first adjust the options, for example, set the colour of the line, then click on the background at the desired start position and drag across to where you want the line to end.  When the line has been drawn, you can select it by clicking on it.  This redisplays the options so that you can modify the line, for example to make it thicker."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Rectangle")," The options are the width of the border around the rectangle and the border's colour, the colour of the inside of the rectangle (the 'fill' colour) and whether it should have rounded or sharp corners.  To draw a rectangle, click where one corner should be, then drag to where the opposite corner should be."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Text"),"  Use this tool to add text to the background. The options are the colour and size of the text.  Click on the background to position a text box into which you can type.  Then type your text (to replace the the sample ",(0,r.kt)("em",{parentName:"li"},"Text"),"). Click anywhere outside the box to finish.  The text can continue over several lines."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Pencil")," draws freehand lines."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Marker")," draws lines like a marker or highlighter pen."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Image")," Clicking on this tool gives you a file chooser to select an image file (picture) from your computer - JPG, PNG and GIF formats are accepted. When the image has been placed on the background, you can drag it to where you want it, and resize it using the control points (small blue dots at the corners).  Click anywhere outside the image when you have got it into the right location."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Group")," This groups objects so that they move together (see ",(0,r.kt)("a",{parentName:"li",href:"#grouping-objects"},"below")," for details)."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Delete")," Deletes (erases) the selected object(s). The ",(0,r.kt)("kbd",null,"Delete")," key on the keyboard can also be used."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Undo")," This tool will undo the effect of the last action (e.g. if you have just placed an image on the background, it will remove the image,  if you have drawn a line with the pencil, it will undo that line, or if you have moved a rectangle, it will undo the move).  Each click of the Undo button removes one previous drawing action. ",(0,r.kt)("kbd",null,"\u2318"),(0,r.kt)("kbd",null,"Z")," or ",(0,r.kt)("kbd",null,"\u2303"),(0,r.kt)("kbd",null,"Z")," can also be used."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Redo")," Reverses the action of the previous Undo, e.g. restoring the removed image. ",(0,r.kt)("kbd",null,"\u2318"),(0,r.kt)("kbd",null,"Y")," or ",(0,r.kt)("kbd",null,"\u2303"),(0,r.kt)("kbd",null,"Y"),"can also be used.")),(0,r.kt)("h2",{id:"grouping-objects"},"Grouping objects"),(0,r.kt)("p",null,"A single object can be selected by clicking on it.  To select more than one object, either:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"(with a keyboard) hold down the Shift key and click on each object to be included in the selection, or"),(0,r.kt)("li",{parentName:"ul"},"click on the backround and drag over all the objects to be selected")),(0,r.kt)("p",null,"You can then move, expand or shrink, or rotate the selected  objects togther as a group as though they were one object."),(0,r.kt)("p",null,"The grouping only lasts until you click on the background to cancel the selection. To make the group permanent, select the objects and then click on the Group button ",(0,r.kt)("img",{src:o(4256).Z,width:"30"}),". To ungroup a group, select the group and click on the Group button again."),(0,r.kt)("admonition",{type:"tip"},(0,r.kt)("p",{parentName:"admonition"},"Grouping is often useful to combine a textual label with a shape, for example:"),(0,r.kt)("img",{src:o(9306).Z,width:"300"})))}A.isMDXComponent=!0},6978:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/aligningObjects-8083be49d63f226e482ee2a069ceea99.png"},4256:(e,t,o)=>{o.d(t,{Z:()=>n});const n="data:image/png;base64,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"},9306:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/labelledShape-9ff72adcc591eb5c5856ebe02ab62bbb.png"},7203:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/drawingLayer-f0552607827877982e60e41f0a3bba3a.png"},2081:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/drawingLayerSamples-b35088f6644810f858567f97ed92e134.png"}}]);