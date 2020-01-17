/* 
The main entry point for PRISM.  
Sets up the data structures for the netwok.
 */
import * as Y from 'yjs';
import {
	WebsocketProvider
}
from 'y-websocket';

import {
	 Network, parseGephiNetwork
}
from "vis-network/peer/esm/vis-network";

import {
	DataSet
}
from "vis-data";

import 'vis-network/dist/vis-network.min.css';

/*
Remember to start the WS provider first:
	npx y-websocket-server
*/

const version = "0.9";

var network, room, nodes, edges, data, clientID, yNodesMap, yEdgesMap;

var lastNodeSample = null;
var lastLinkSample = null;
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer


window.addEventListener('load', () => {
	checkFeatures();
	addEventListeners();
	setUpPage();
	startY();
	draw();
});

function checkFeatures() {
	if (!(Modernizr.borderradius && Modernizr.boxsizing && Modernizr.flexbox && 
		Modernizr.boxshadow && Modernizr.opacity && Modernizr.canvas && 
		Modernizr.fileinput && Modernizr.eventlistener && Modernizr.webworkers
		&& Modernizr.json && Modernizr.canvastext)) {
		alert("Your browser does not support all the features required.  Try an up-to-date copy of Edge, Chrome or Safari");
		}
}
		

function addEventListeners() {
	// Clicking anywhere other than on the tabs clears the status bar 
	// (note trick: click is processed in the capturing phase)
	document.getElementById("net-pane").addEventListener("click", () => {
		clearStatusBar();
	}, true);
	document.getElementById("openFile").addEventListener("click", openFile);
	document.getElementById("saveFile").addEventListener("click", saveJSONfile);
	document.getElementById("panelToggle").addEventListener("click", togglePanel);
	document.getElementById("addNode").addEventListener("click", plusNode);
	document.getElementById("addLink").addEventListener("click", plusLink);
	document.getElementById("deleteNode").addEventListener("click", deleteNode);
	document.getElementById('fileInput').addEventListener('change', readSingleFile, false);

	// Add event listeners to tab buttons
	document.getElementById("nodesButton").addEventListener("click", () => {
		openTab("nodesTab");
	}, false);
	document.getElementById("linksButton").addEventListener("click", () => {
		openTab("linksTab");
	}, false);
	document.getElementById("networkButton").addEventListener("click", () => {
		openTab("networkTab");
	}, false);
	document.getElementById('notes').addEventListener('click', addEditor);
	document.getElementById('autolayoutswitch').addEventListener('click', autoLayoutSwitch);
	document.getElementById('netBackColorWell').addEventListener('input', updateNetBack, false);
	document.getElementById('allFactors').addEventListener('click', selectAllFactors);
	document.getElementById('allEdges').addEventListener('click', selectAllEdges);
	document.getElementById('showLabelSwitch').addEventListener('click', labelSwitch);
	document.getElementById('showLabelSwitch').addEventListener('click', labelSwitch);
	document.getElementById('layoutSelect').addEventListener('change', selectLayout);	
	document.getElementById('curveSelect').addEventListener('change', selectCurve);	
	document.getElementById('dimRest').addEventListener('change', (value) => { selectDim(value)});	
	document.getElementById('zoom').addEventListener('change', zoomnet);
}

function setUpPage() {
	let container = document.getElementById("container");
	let panel = document.getElementById("panel");
	panel.classList.add('hide');
	container.panelHidden = true;
}

function startY() {

// create a new shared document and start the WebSocket provider

	let url = new URL(document.location);
	room = url.searchParams.get('room');
	if (room == null) room = rndString(10);
	
	const doc = new Y.Doc();
	const wsProvider = new WebsocketProvider('ws://192.168.0.12:1234', 'prism' + room, doc);
	wsProvider.on('status', event => {
		console.log(event.status + ' to room ' + room) // logs "connected" or "disconnected"
		});

	/* 
	create a yMap for the nodes and one for the edges (we need two because there is no 
	guarantee that the the ids of nodes will differ from the ids of edges 
	 */
	yNodesMap = doc.getMap('nodes');
	yEdgesMap = doc.getMap('edges');

	if (localStorage.getItem('clientID')) clientID = localStorage.getItem('clientID')
	else {
		clientID = doc.clientID;  // used to identify nodes and edges created by this client
		localStorage.setItem('clientID', clientID);
		}
	console.log('My client ID: ' + clientID);


	nodes = new DataSet();
	edges = new DataSet();
	data = {
		nodes: nodes,
		edges: edges
	};

	/* 
	for convenience when debugging
	 */
	window.data = data;
	window.yNodesMap = yNodesMap;
	window.yEdgesMap = yEdgesMap;

	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcat to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast, with a 
	copy of the node, augmented with this client's ID, so that the originator can be identified.
	Nodes that are not originated locally are not broadcast (if they were, there would be a 
	feedback loop, with each client re-broadcasting everything it received)
	 */

	nodes.on('*', (event, properties) => {
		properties.items.forEach(id => {
			console.log('nodes.on: ' + event + JSON.stringify(properties.items));
			if (event == 'remove') {
				yNodesMap.delete(id.toString()); console.log('deleted from YMapNodes: ' + id);
				}
			else {
				let obj = nodes.get(id);
				if (obj.clientID == undefined || obj.clientID == clientID) {
					obj.clientID = clientID;
					yNodesMap.set(id.toString(), obj); 
					console.log('setting yNodesMap: ' + id + ' to ' + JSON.stringify(obj));		
				}
			}
		})
	});

	/* 
	yNodesMap.observe listens for changes in the yMap, reciving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node is
	removed from the local nodes dataSet. Otherwise, the local node dataSet is updated (which 
	includes adding a new node if it does not already exist locally).
	 */

	yNodesMap.observe((event, trans) => { console.log(event);
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key);
				if (obj.clientID != clientID) {
					nodes.update(obj);
				}
			}
			else nodes.remove(key);
		}
	});

	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties) => {
		properties.items.forEach(id => {
			if (event == 'remove') {
				yEdgesMap.delete(id.toString())
			}
			else {
				let obj = edges.get(id);
				if (obj.clientID == undefined || obj.clientID == clientID) {
					obj.clientID = clientID;
					yEdgesMap.set(id.toString(), obj);
				}
			}
		})
	});

	yEdgesMap.observe((event, trans) => {
		for (let key of event.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key);
				if (obj.clientID != clientID) {
					edges.update(obj);
				}
			}
			else edges.remove(key);
		}
	});

}

function getRandomData(nNodes) {
	// randomly create some nodes and edges
	var SFNdata = getScaleFreeNetwork(nNodes);
	nodes.add(SFNdata.nodes);
	edges.add(SFNdata.edges);
	recalculateStats();
};

function draw() {

	// for testing, append ?t=XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let url = new URL(document.location);
	let nNodes = url.searchParams.get('t');
	if (nNodes) getRandomData(nNodes); // start with some random network

	// create a network
	var container = document.getElementById('net-pane');
	var options = {
		physics: {
			enabled: false,
			stabilization: false
		},
		edges: groupEdges.edge0,
		groups: groups,
		nodes: {
			group: 'group0'
		},
		interaction: {
			multiselect: true,
			hover: true,
			zoomView: false
		},
		layout: {
			improvedLayout: (data.nodes.length < 150)
		},
		manipulation: {
			enabled: false,
			addNode: function(data, callback) {
				// filling in the popup DOM elements
				data.label = '';
				if (lastNodeSample) data.group = lastNodeSample;
				document.getElementById('node-operation').innerHTML = "Add Factor";
				editNode(data, clearNodePopUp, callback);
			},
			editNode: function(data, callback) {
				// filling in the popup DOM elements
				document.getElementById('node-operation').innerHTML = "Edit Factor";
				editNode(data, cancelNodeEdit, callback);
			},
			addEdge: function(data, callback) {
				inAddMode = false;
				changeCursor("auto");
				if (data.from == data.to) {
					var r = confirm("Do you want to connect the Factor to itself?");
					if (r != true) {
						callback(null);
						return;
					}
				}
				if (lastLinkSample) data = Object.assign(data, groupEdges[lastLinkSample]);
				callback(data);
			},
			editEdge: {
				editWithoutDrag: function(data, callback) {
					document.getElementById('edge-operation').innerHTML = "Edit Edge";
					editEdgeWithoutDrag(data, callback);
				}
			},
			deleteNode: function(data, callback) {
				var r = confirm(deleteMsg(data));
				if (r != true) {
					callback(null);
					return;
				}
				callback(data);
			},
			deleteEdge: function(data, callback) {
				var r = confirm(deleteMsg(data));
				if (r != true) {
					callback(null);
					return;
				}
				callback(data);
			},
			controlNodeStyle: {
				shape: 'dot',
				color: 'black',
				group: 'group8'
			}
		}
	};

	network = new Network(container, data, options);
	window.network = network;
	// start with factor tab open
	document.getElementById("nodesButton").click();

	// listen for click events on the network pane
	network.on("doubleClick", function(params) {
		if (params.nodes.length === 1) {
			network.editNode();
		} else {
			network.fit();
			document.getElementById('zoom').value = network.getScale();
		}
	});
	network.on('selectNode', function() {
		statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
		displayNotes();
	});
	network.on('deselectNode', function() {
		hideNotes();
		clearStatusBar();
	});
	network.on('hoverNode', function() {
		changeCursor('grab');
	});
	network.on('blurNode', function() {
		changeCursor('default');
	});
	network.on('dragStart', function() {
		changeCursor('grabbing');
	});
	network.on('dragging', function() {
		changeCursor('grabbing');
	});
	network.on('dragEnd', function() {
		changeCursor('grab');
	});

	// listen for changes to the network structure
	data.nodes.on('add', recalculateStats);
	data.nodes.on('remove', recalculateStats);
	data.edges.on('add', recalculateStats);
	data.edges.on('remove', recalculateStats);

	function editNode(data, cancelAction, callback) {
		inAddMode = false;
		changeCursor('auto');
		let popUp = document.getElementById('node-popUp');
		document.getElementById('node-cancelButton').onclick = cancelAction.bind(this, callback);
		document.getElementById('node-saveButton').onclick = saveNodeData.bind(this, data, callback);
		popUp.style.display = 'block';
		popUp.style.top = `${event.clientY - popUp.offsetHeight / 2}px`;
		popUp.style.left = `${event.clientX - popUp.offsetWidth - 3}px`;
		document.getElementById('node-label').value = data.label;
		document.getElementById('node-label').focus();
		/* allow Enter to click the Save button */
		document.getElementById('node-label').addEventListener("keypress", 
			function onEvent(event) {
    			if (event.key === "Enter") {
        			document.getElementById("node-saveButton").click();
    			}
			});
	}

	// Callback passed as parameter is ignored
	function clearNodePopUp() {
		document.getElementById('node-saveButton').onclick = null;
		document.getElementById('node-cancelButton').onclick = null;
		document.getElementById('node-popUp').style.display = 'none';
	}

	function cancelNodeEdit(callback) {
		clearNodePopUp();
		callback(null);
	}

	function saveNodeData(data, callback) {
		data.label = document.getElementById('node-label').value;
		clearNodePopUp();
		if (data.label === "") {
			document.getElementById("statusBar").innerHTML = "No label: cancelled";
			callback(null);
		} else callback(data);
	}
	
} // end draw()

function deleteMsg(data) {
	let nNodes = data.nodes.length;
	let nEdges = data.edges.length;
	let msg = 'Delete '; 
	if (nNodes > 0) msg = msg + nNodes + ' Factor' + (nNodes == 1 ? "" : "s");
	if (nNodes > 0 && nEdges > 0) msg = msg + ' and ';
	if (nEdges > 0) msg = msg + nEdges + ' Link' + (nEdges == 1 ? "" : "s");
	return msg + '?';
}
	
function changeCursor(newCursorStyle) {
	if (inAddMode) return;
	document.getElementById("net-pane").style.cursor = newCursorStyle;
	document.getElementById("navbar").style.cursor = newCursorStyle;
}


var worker = new Worker('./js/betweenness.js');
var bc;

function recalculateStats() {
	worker.postMessage([nodes.get(), edges.get()]);
}

worker.onmessage = function(e) {
	bc = e.data;
}


/* show status messages at the bottom of the window */

function statusMsg(msg) {
	document.getElementById("statusBar").innerHTML = msg;
}

function listFactors(nodes) {
	// return a string listing the labels of the given nodes
	let str = 'Factor';
	if (nodes.length > 1) str = str + 's';
	return str + ' ' + lf(nodes);
}

function lf(nodes) {
	// return a string of the node labels, separated by commas and 'and'
	let n = nodes.length;
	let label = data.nodes.get(nodes[0]).label
	if (n == 1) return label;
	nodes.shift();
	if (n == 2) return label.concat(' and ' + lf(nodes));
	return label.concat(', ' + lf(nodes));
}

function clearStatusBar() {
	statusMsg("<br>");
}

/* 
--------------------------------------------navbar.js--------------------------------------------
 */
var lastFileName = 'network.json';



function togglePanel() {
	if (container.panelHidden) {
		container.style.gridTemplateColumns = "5fr minmax(200px, 1fr)";// "1fr 200px";
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide');
		container.style.gridTemplateColumns = "1fr 0px";
	}
	container.panelHidden = !container.panelHidden;
}

function readSingleFile(e) {
	var file = e.target.files[0];
	if (!file) {
		return;
	}
	let fileName = file.name;
	lastFileName = fileName;
	statusMsg("Reading '" + fileName + "'");
	e.target.value='';
	var reader = new FileReader();
	reader.onloadend = function(e) {
		try { console.log(e.target.result);
			let json = JSON.parse(e.target.result); 
			loadJSONfile(json);
			statusMsg("Read '" + fileName + "'");
		} catch (err) {
			statusMsg("Error reading '" + fileName + "': " + err.message);
			return;
		}
	};
	reader.readAsText(file);
}

function openFile() {
	document.getElementById('fileInput').click();
}


function loadJSONfile(json) {
	if (data.nodes.length > 0)
		if (!confirm("Loading a file will delete the current network.  Are you sure you want to replace it?")) return;
	nodes.clear();
	edges.clear();
	hideNotes();
	let options = {
		edges: {
			inheritColors: false
		},
		nodes: {
			fixed: false,
			parseColor: true
		}
	};
	if (json.version && (version > json.version)) {
		statusMsg("Warning: file was created in an earlier version of PRISM");
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample;
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample;
	if ('source' in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, options);
		nodes.add(parsed.nodes);
		edges.add(parsed.edges);
	} else {
		nodes.add(json.nodes);
		edges.add(json.edges);
	}
	data = {
		nodes: nodes,
		edges: edges
	};
	network.setOptions({
		interaction: {
			hideEdgesOnDrag: data.nodes.length > 100,
			hideEdgesOnZoom: data.nodes.length > 100
		}
	});
	/* TODO
		if (json.groups) {
			groups = json.groups;
			network.setOptions({groups: groups});
			}
	 */
	if (json.groupEdges) {
		groupEdges = json.groupEdges;
	}
	network.setData(data);
	updateYMaps();
}

function updateYMaps() {
	data.nodes.forEach ((obj) => {
		let id = obj.id;
		obj.clientID = clientID;
		yNodesMap.set(id.toString(), obj); 
	});
	data.edges.forEach ((obj) => {
		let id = obj.id;
		obj.clientID = clientID;
		yEdgesMap.set(id.toString(), obj); 
	});				
}

/* 
Browser will only ask for name and location of the file to be saved if
it has a user setting to do so.  Otherwise, it is saved at a default
download location with a default name.
 */

function saveJSONfile() {
	network.storePositions();
	let json = JSON.stringify({
		saved: new Date(Date.now()).toLocaleString(),
		version: version,
		lastNodeSample: lastNodeSample,
		lastLinkSample: lastLinkSample,
		groups: network.groups.groups,
		groupEdges: groupEdges,
		nodes: data.nodes.get(),
		edges: data.edges.get()
	});
	let element = document.getElementById("download");
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
	element.setAttribute('download', lastFileName);
	element.click();
}

function plusNode() {
	statusMsg("Add Node mode");
	changeCursor("cell");
	inAddMode = true;
	network.addNodeMode();
}

function plusLink() {
	statusMsg("Add Edge mode");
	changeCursor("crosshair");
	inAddMode = true;
	network.addEdgeMode();
}

function deleteNode() {
	network.deleteSelected();
}

Network.prototype.zoom = function(scale) {
	let newScale = (scale === undefined ? 1 : scale);
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 300
		}
	};
	this.view.moveTo(animationOptions);
};

function zoomnet() {
	network.zoom(document.getElementById("zoom").value);
}

/* Share modal dialog */


// Get the modal
var modal = document.getElementById("shareModal");

// Get the button that opens the modal
var btn = document.getElementById("share");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// Get the input element to be filled with the link
var inputElem = document.getElementById('text-to-copy');

// And the place to say that the link has been copied to the clipboard
var copiedText = document.getElementById('copied-text');

// When the user clicks the button, open the modal 
btn.onclick = function() {
	let linkToShare = window.location.origin + window.location.pathname + '?room=' + room;
	copiedText.style.display = 'none';
	modal.style.display = "block";
	inputElem.setAttribute('size', linkToShare.length);
	inputElem.value = linkToShare;
	inputElem.select();
	network.storePositions();
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
	modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target == modal) {
		modal.style.display = "none";
	}
}

document.getElementById('copy-text').addEventListener('click', function(e) {

	e.preventDefault();

	// Select the text
	inputElem.select();

	let copied;
	try {
		// Copy the text
		copied = document.execCommand('copy');
	} catch (ex) {
		copied = false;
	}
	if (copied) {
		// Display the copied text message
		copiedText.style.display = 'inline-block';
	}
});


function rndString(length) {
	let str = "";
	for (let i = 0; i < length; i++) {
		str = str + (Math.random() * 100).toFixed().toString();
	}
	return str;
}

/* --------------------------------------------tabs.js-------------------------------------------- */

var tabOpen = null;

function openTab(tabId) {
	// Declare all variables
	var i, tabcontent, tablinks;

	// Get all elements with class="tabcontent" and hide them by moving them off screen
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].classList.add('hide');
	}

	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}

	// Show the current tab, and add an "active" class to the button that opened the tab
	document.getElementById(tabId).classList.remove('hide');
	event.currentTarget.className += " active";

	tabOpen = tabId;
	if (tabOpen == 'nodesTab') displayNotes();
}
// Factors and Links Tabs

// samples

// Get all elements with class="sampleNode" and add listener and canvas
let emptyDataSet = new DataSet([]);
let sampleElement, sampleFormat;
let sampleElements = document.getElementsByClassName("sampleNode");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
	sampleElement.addEventListener("click", () => {
		applySampleToNode();
	}, false);
	let nodeDataSet = new DataSet([{
		id: 1,
		label: 'Sample',
		group: 'group' + i
	}]);
	let sampleNetwork = initSample(sampleElement, {
		nodes: nodeDataSet,
		edges: emptyDataSet
	});
	sampleNetwork.on("doubleClick", function(params) {
		if (params.nodes.length === 1) {
			sampleNetwork.editNode();
		}
	});
	sampleElement.group = 'group' + i;
}
// and to all sampleLinks
sampleElements = document.getElementsByClassName("sampleLink");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
	sampleElement.addEventListener("click", () => {
		applySampleToLink();
	}, false);
	let edgeDataSet = new DataSet([Object.assign({
		from: 1,
		to: 2,
		value: 7
	}, groupEdges['edge' + i])])
	let nodesDataSet = new DataSet([{
		id: 1
	}, {
		id: 2
	}])
	initSample(sampleElement, {
		nodes: nodesDataSet,
		edges: edgeDataSet
	});
	sampleElement.groupLink = 'edge' + i;
}

function initSample(wrapper, sampleData) {
	let options = {
		interaction: {
			dragNodes: false,
			dragView: false,
			selectable: true,
			zoomView: false
		},
		manipulation: {
			enabled: false,
			editNode: function(data, callback) {
				// filling in the popup DOM elements
				document.getElementById('node-operation').innerHTML = "Group name";
				editNode(data, cancelNodeEdit, callback);
			}
		},
		layout: {
			hierarchical: {
				enabled: true,
				direction: 'LR'
			}
		},
		groups: groups
	};
	let net = new Network(wrapper, sampleData, options);
	net.storePositions();
	wrapper.net = net;
	return net;
}

function applySampleToNode() {
	let selectedNodeIds = network.getSelectedNodes();
	if (selectedNodeIds.length == 0) return;
	let nodesToUpdate = [];
	for (let node of data.nodes.get(selectedNodeIds)) {
		node.group = event.currentTarget.group;
		delete node.color;
		nodesToUpdate.push(node);
	}
	data.nodes.update(nodesToUpdate);
	network.unselectAll();
	hideNotes();
	lastNodeSample = event.currentTarget.group;
}

function applySampleToLink() {
	let selectedEdges = network.getSelectedEdges();
	if (selectedEdges.length == 0) return;
	let edgesToUpdate = [];
	for (let edge of data.edges.get(selectedEdges)) {
		edge = Object.assign(edge, groupEdges[event.currentTarget.groupLink]);
		edgesToUpdate.push(edge);
	}
	data.edges.update(edgesToUpdate);
	network.unselectAll();
	hideNotes();
	lastLinkSample = event.currentTarget.groupLink;
}

// Notes

var editor = null;

function addEditor() {
	editor = new nicEditor({
		buttonList: ['bold', 'italic', 'underline'],
		iconsPath: 'js/nicEdit/nicEditorIcons.gif',
		maxHeight: '30px'
	}).panelInstance('notes', {
		hasPanel: true
	});
	editor.addEvent('blur', removeEditor);
}

function removeEditor() {
	if (editor.nicInstances.length > 0) {
		let title = stripTags(editor.nicInstances[0].getContent(), "<b><i><u><div><font>");
		let nodeId = network.getSelectedNodes()[0];
		data.nodes.update({
			id: nodeId,
			title: title
		});

		editor.removeInstance('notes');
	}
}

function stripTags(input, allowed) {

	// making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
	allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('')

	var tags = /<\/?([a-z0-9]*)\b[^>]*>?/gi
	var commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi

	var after = input
	// removes tha '<' char at the end of the string to replicate PHP's behaviour
	after = (after.substring(after.length - 1) === '<') ? after.substring(0, after.length - 1) : after

	// recursively remove tags to ensure that the returned string doesn't contain forbidden tags after previous passes (e.g. '<<bait/>switch/>')
	while (true) {
		var before = after
		after = before.replace(commentsAndPhpTags, '').replace(tags, function($0, $1) {
			return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : ''
		})

		// return once no more tags are removed
		if (before === after) {
			return after
		}
	}
}

var lastSelectedNode;

function displayNotes() {
	let panel = document.getElementById("oneNodeSelected");
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes != lastSelectedNode) panel.classList.add('hide');
	if (tabOpen == 'nodesTab' && selectedNodes.length == 1) {
		let nodeId = selectedNodes[0];
		let node = data.nodes.get(nodeId);
		let label = (node.label ? node.label : node.hiddenLabel);
		document.getElementById("nodeLabel").innerHTML = (label ? label : "");
		let title = node.title;
		document.getElementById("notes").innerHTML = (title ? title : "");
		panel.classList.remove('hide');
		displayStatistics(nodeId);
	} else {
		panel.classList.add('hide')
	}
}

function hideNotes() {
	document.getElementById("oneNodeSelected").classList.add('hide')
}

hideNotes();

// Statistics specific to a node

function displayStatistics(nodeId) {

	let inDegree = network.getConnectedNodes(nodeId, 'from').length;
	let outDegree = network.getConnectedNodes(nodeId, 'to').length;
	let leverage = (inDegree == 0) ? '--' : (outDegree / inDegree).toPrecision(3);
	document.getElementById('leverage').textContent = leverage;
	document.getElementById('bc').textContent = 
		(bc[nodeId] >= 0 ? (bc[nodeId]).toPrecision(3) : '--');
}


// Network tab


function autoLayoutSwitch(e) {
	network.setOptions({
		'physics': {
			'enabled': e.target.checked
		}
	});
}

function selectLayout() {
	network.setOptions({
		layout: {
			hierarchical: document.getElementById('layoutSelect').value === 'Hierarchical'
		}
	});
}

function selectCurve() {
	network.setOptions({
		edges: {
			smooth: document.getElementById('curveSelect').value === 'Curved'
		}
	});
}

function updateNetBack(event) {
	document.getElementById('net-pane').style.backgroundColor = event.target.value;
}

function selectAllFactors() {
	network.selectNodes(network.body.nodeIndices);
}

function selectAllEdges() {
	network.selectEdges(network.body.edgeIndices);
}


var labelsShown = true;

function labelSwitch(e) {
	if (labelsShown) {
		labelsShown = false;
		hideLabels();
	} else {
		labelsShown = true;
		unHideLabels()
	}
}

function hideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(
		function(n) {
			if (n.hiddenLabel == undefined) n.hiddenLabel = n.label;
			n.label = undefined;
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);
}

function unHideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(
		function(n) {
			if (n.hiddenLabel) n.label = n.hiddenLabel;
			n.hiddenLabel = undefined;
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);
}

function selectDim(event) {
	let sel = event.currentTarget.value;
	if (sel == 'All') unDimAll();
	else hideDistantNodes(sel);
}

function hideDistantNodes(radius) {
	unDimAllNodes();
	unDimAllLinks();
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes.length == 0 || selectedNodes == lastSelectedNode) {
		statusMsg('Select a Factor first');
		document.getElementById('dimRest').value = 'All';
		return;
		}
	dimAllNodes();
	dimAllLinks();

	let nodeIdsInRadius = new Set();
	let linkIdsInRadius = new Set();
	nn(selectedNodes, radius);
	unDimNodes(data.nodes.get(Array.from(nodeIdsInRadius)));
	unDimLinks(data.edges.get(Array.from(linkIdsInRadius)));
	if (selectedNodes.length == 1) network.focus(selectedNodes[0]);

	function nn(nodeIds, radius) {
		if (radius < 0) return;
		nodeIds.forEach(function(nId) {
			nodeIdsInRadius.add(nId);
			let links = network.getConnectedEdges(nId);
			if (links && radius > 0) links.forEach(function(lId) {
				linkIdsInRadius.add(lId);
			});
			let linked = network.getConnectedNodes(nId);
			if (linked) nn(linked, radius - 1);
		})
	}
}

const dimColor = "#f1f2f3";

function dimAllNodes() {
	dimNodes(data.nodes.get());
}

function dimNodes(nodeArray) {
	data.nodes.update(nodeArray.map(dimNode));
}

function unDimAllNodes() {
	unDimNodes(data.nodes.get());
}

function unDimNodes(nodeArray) {
	data.nodes.update(nodeArray.map(unDimNode));
}

function dimAllLinks() {
	dimLinks(data.edges.get());
}

function dimLinks(edgeArray) {
	data.edges.update(edgeArray.map(dimLink));
}

function unDimAllLinks() {
	unDimLinks(data.edges.get());
}

function unDimLinks(edgeArray) {
	data.edges.update(edgeArray.map(unDimLink));
}

function dimNode(node) {
	node.hiddenLabel = node.label;
	node.hiddenColor = node.color;
	node.hiddenGroup = (node.group ? node.group : "group0");
	node.label = undefined;
	node.color = dimColor;
	node.group = "dimmedGroup";
	return node;
}

function unDimNode(node) {
	if (node.label == undefined) node.label = node.hiddenLabel;
	if (node.color == dimColor) node.color = node.hiddenColor;
	if (node.group == "dimmedGroup") node.group = node.hiddenGroup;
	delete node.hiddenLabel;
	delete node.hiddenColor;
	delete node.hiddenGroup;
	return node;
}

function dimLink(link) {
	link.hiddenColor = link.color;
	link.color = dimColor;
	return link;
}

function unDimLink(link) {
	if (link.color == dimColor) link.color = link.hiddenColor;
	if (!link.color) link.color = groupEdges.edge0.color;
	delete link.hiddenColor;
	return link;
}

function unDimAll() {
	unDimAllNodes();
	unDimAllLinks();
}


