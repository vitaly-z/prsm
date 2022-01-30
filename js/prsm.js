/* 
The main entry point for PRSM.  
 */

import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
// import {IndexeddbPersistence} from 'y-indexeddb'
import {Network, parseGephiNetwork} from 'vis-network/peer'
import {DataSet} from 'vis-data/peer'
import diff from 'microdiff'
import {
	listen,
	elem,
	getScaleFreeNetwork,
	uuidv4,
	isEmpty,
	deepMerge,
	deepCopy,
	splitText,
	dragElement,
	standardize_color,
	object_equals,
	generateName,
	statusMsg,
	clearStatusBar,
	shorten,
	initials,
	CP,
	timeAndDate,
	setEndOfContenteditable,
	exactTime,
} from './utils.js'
import Tutorial from './tutorial.js'
import {styles} from './samples.js'
import {trophic} from './trophic.js'
import {cluster, openCluster} from './cluster.js'
import * as parser from 'fast-xml-parser'
// see https://github.com/joeattardi/emoji-button
import {EmojiButton} from '@joeattardi/emoji-button'
import Quill from 'quill'
import {QuillDeltaToHtmlConverter} from 'quill-delta-to-html'
import Hammer from '@egjs/hammerjs'
import {setUpSamples, reApplySampleToNodes, reApplySampleToLinks, legend, clearLegend, updateLegend} from './styles.js'
import {setUpPaint, setUpToolbox, deselectTool, redraw} from './paint.js'
import {version} from '../package.json'
import {compressToUTF16, decompressFromUTF16} from 'lz-string'

const appName = 'Participatory System Mapper'
const shortAppName = 'PRSM'
const GRIDSPACING = 50 // for snap to grid
const NODEWIDTH = 10 // chars for label splitting
const TIMETOSLEEP = 15 * 60 * 1000 // if no mouse movement for this time, user is assumed to have left or is sleeping
const TIMETOEDIT = 5 * 60 * 1000 // if node/edge edit dialog is not saved after this time, the edit is cancelled
const magnification = 3 // magnification of the loupe (magnifier 'glass')
export const NLEVELS = 20 // max. number of levels for trophic layout

export var network
var room
export var debug = '' // if includes 'yjs', all yjs sharing interactions are logged to the console; if 'gui' mouse events are reported
var viewOnly // when true, user can only view, not modify, the network
var nodes // a dataset of nodes
var edges // a dataset of edges
export var data // an object with the nodes and edges datasets as properties
export const doc = new Y.Doc()
export var websocket = 'wss://www.prsm.uk/wss' // web socket server URL
export var clientID // unique ID for this browser
var yNodesMap // shared map of nodes
var yEdgesMap // shared map of edges
export var ySamplesMap // shared map of styles
export var yNetMap // shared map of global network settings
export var yPointsArray // shared array of the background drawing commands
var yUndoManager // shared list of commands for undo
var dontUndo // when non-null, don't add an item to the undo stack
var yChatArray // shared array of messages in the chat window
var yAwareness // awareness channel
var yHistory // log of actions
export var container //the DOM body element
var netPane // the DOM pane showing the network
var panel // the DOM right side panel element
var myNameRec // the user's name record {actual name, type, etc.}
var lastNodeSample = 'group0' // the last used node style
var lastLinkSample = 'edge0' // the last used edge style
/** @type {(string|boolean)} */
var inAddMode = false // true when adding a new Factor to the network; used to choose cursor pointer
var inEditMode = false //true when node or edge is being edited (dialog is open)
var snapToGridToggle = false // true when snapping nodes to the (unseen) grid
export var drawingSwitch = false // true when the drawing layer is uppermost
var showNotesToggle = true // show notes when factors and links are selected
// if set, there are  nodes that need to be hidden when the map is drawn for the first time
var hiddenNodes = {radiusSetting: null, streamSetting: null, pathsSetting: null, selected: []}
var tutorial = new Tutorial() // object driving the tutorial
export var cp // color picker
var checkMapSaved = false // if the map is new (no 'room' in URL), or has been imported from a file, and changes have been made, warn user before quitting
var dirty = false // map has been changed by user and may need saving
var hammer // Hammer pinch recogniser instance
var followme // clientId of user's cursor to follow
var editor = null // Quill editor
var loadingDelayTimer // timer to delay the start of the loading animation for few moments
var netLoaded = false // becomes true when map is fully displayed
var savedState = '' // the current sate of the map (nodes, edges, network settings) before current user action
/**
 * top level function to initialise everything
 */
window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 100)
	addEventListeners()
	setUpPage()
	startY()
	setUpChat()
	setUpAwareness()
	setUpPaint()
	setUpToolbox()
	setUpShareDialog()
	draw()
})
/**
 * Clean up before user departs
 */

window.onbeforeunload = function (event) {
	unlockAll()
	yAwareness.setLocalStateField('addingFactor', 'done')
	// get confirmation from user before exiting if there are unsaved changes
	if (checkMapSaved && dirty) {
		event.preventDefault()
		event.returnValue = 'You have unsaved unchages.  Are you sure you want to leave?'
	}
}
/**
 * Set up all the permanent event listeners
 */
function addEventListeners() {
	listen('maptitle', 'keydown', (e) => {
		//disallow Enter key
		if (e.key === 'Enter') {
			e.preventDefault()
		}
	})
	listen('net-pane', 'keydown', (e) => {
		if (e.which == 8 || e.which == 46) deleteNode()
	})
	listen('recent-rooms-caret', 'click', createTitleDropDown)
	listen('maptitle', 'keyup', mapTitle)
	listen('maptitle', 'paste', pasteMapTitle)
	listen('maptitle', 'click', (e) => {
		if (e.target.innerText == 'Untitled map') window.getSelection().selectAllChildren(e.target)
	})
	listen('addNode', 'click', plusNode)
	listen('net-pane', 'contextmenu', contextMenu)
	listen('net-pane', 'click', unFollow)
	listen('net-pane', 'click', removeTitleDropDown)
	listen('addLink', 'click', plusLink)
	listen('deleteNode', 'click', deleteNode)
	listen('undo', 'click', undo)
	listen('redo', 'click', redo)
	listen('fileInput', 'change', readSingleFile)
	listen('openMap', 'click', openFile)
	listen('saveFile', 'click', savePRSMfile)
	listen('exportPRSM', 'click', savePRSMfile)
	listen('exportImage', 'click', exportPNGfile)
	listen('exportCVS', 'click', exportCVS)
	listen('exportGML', 'click', exportGML)
	listen('search', 'click', search)
	listen('help', 'click', displayHelp)
	listen('panelToggle', 'click', togglePanel)
	listen('zoom', 'change', zoomnet)
	listen('navbar', 'dblclick', fit)
	listen('zoomminus', 'click', () => {
		zoomincr(-0.1)
	})
	listen('zoomplus', 'click', () => {
		zoomincr(0.1)
	})
	listen('nodesButton', 'click', () => {
		openTab('nodesTab')
	})
	listen('linksButton', 'click', () => {
		openTab('linksTab')
	})
	listen('networkButton', 'click', () => {
		openTab('networkTab')
	})
	listen('analysisButton', 'click', () => {
		openTab('analysisTab')
	})
	listen('layoutSelect', 'change', autoLayout)
	listen('snaptogridswitch', 'click', snapToGridSwitch)
	listen('curveSelect', 'change', selectCurve)
	listen('drawing', 'click', toggleDrawingLayer)
	listen('allFactors', 'click', selectAllFactors)
	listen('allLinks', 'click', selectAllLinks)
	listen('showLegendSwitch', 'click', legendSwitch)
	listen('showUsersSwitch', 'click', showUsersSwitch)
	listen('showHistorySwitch', 'click', showHistorySwitch)
	listen('showNotesSwitch', 'click', showNotesSwitch)
	listen('clustering', 'change', selectClustering)
	listen('lock', 'click', setFixed)
	Array.from(document.getElementsByName('radius')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	Array.from(document.getElementsByName('stream')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	Array.from(document.getElementsByName('paths')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	listen('sizing', 'change', sizingSwitch)
	Array.from(document.getElementsByClassName('sampleNode')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToNode(event)
		})
	)
	Array.from(document.getElementsByClassName('sampleLink')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToLink(event)
		})
	)
	listen('container', 'copy', copyToClipboard)
	listen('container', 'paste', pasteFromClipboard)
}

/**
 * create all the DOM elements on the web page
 */
function setUpPage() {
	elem('version').innerHTML = version
	// check options set on URL: ?debug=yjs|gui|cluster&viewing&start
	let searchParams = new URL(document.location).searchParams
	if (searchParams.has('debug')) debug = searchParams.get('debug')
	// don't allow user to change anything if URL includes ?viewing
	viewOnly = searchParams.has('viewing')
	if (viewOnly) elem('buttons').style.display = 'none'
	// treat user as first time user if URL includes ?start=true
	if (searchParams.has('start')) localStorage.setItem('doneIntro', 'false')
	container = elem('container')
	netPane = elem('net-pane')
	panel = elem('panel')
	panel.classList.add('hide')
	container.panelHidden = true
	cp = new CP()
	cp.createColorPicker('netBackColorWell', updateNetBack)
	hammer = new Hammer(netPane)
	hammer.get('pinch').set({enable: true})
	hammer.on('pinchstart', () => {
		zoomstart()
	})
	hammer.on('pinch', (e) => {
		zoomset(e.scale)
	})
	setUpSamples()
	updateLastSamples(lastNodeSample, lastLinkSample)
	dragElement(elem('nodeDataPanel'), elem('nodeDataHeader'))
	dragElement(elem('edgeDataPanel'), elem('edgeDataHeader'))
	hideNotes()
}

/**
 * create a new shared document and start the WebSocket provider
 */
function startY(newRoom) {
	if (newRoom) room = newRoom
	else {
		// get the room number from the URL, or if none, generate a new one
		let url = new URL(document.location)
		room = url.searchParams.get('room')
	}
	if (room == null || room == '') {
		room = generateRoom()
		checkMapSaved = true
	} else room = room.toUpperCase()
	/* 	const persistence = new IndexeddbPersistence(room, doc)
	// once the map is loaded, it can be displayed
	persistence.once('synced', () => {
		if (data.nodes.length > 0) displayNetPane(exactTime() + ' local content loaded')
	}) */
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc)
	wsProvider.on('sync', () => {
		displayNetPane(exactTime() + ' remote content loaded')
	})
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room) // logs when websocket is "connected" or "disconnected"
	})
	/* 
	create a yMap for the nodes and one for the edges (we need two because there is no 
	guarantee that the the ids of nodes will differ from the ids of edges) 
	 */
	yNodesMap = doc.getMap('nodes')
	yEdgesMap = doc.getMap('edges')
	ySamplesMap = doc.getMap('samples')
	yNetMap = doc.getMap('network')
	yChatArray = doc.getArray('chat')
	yPointsArray = doc.getArray('points')
	yHistory = doc.getArray('history')
	yAwareness = wsProvider.awareness

	clientID = doc.clientID
	console.log('My client ID: ' + clientID)

	/* set up the undo managers */
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap, yNetMap], {
		trackedOrigins: new Set([null]), // add undo items to the stack by default
	})
	dontUndo = null

	nodes = new DataSet()
	edges = new DataSet()
	data = {
		nodes: nodes,
		edges: edges,
	}

	/* 
	for convenience when debugging
	 */
	window.debug = debug
	window.data = data
	window.clientID = clientID
	window.yNodesMap = yNodesMap
	window.yEdgesMap = yEdgesMap
	window.ySamplesMap = ySamplesMap
	window.yNetMap = yNetMap
	window.yUndoManager = yUndoManager
	window.yChatArray = yChatArray
	window.yHistory = yHistory
	window.yPointsArray = yPointsArray
	window.styles = styles
	window.yAwareness = yAwareness

	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcast to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast.
	 */
	nodes.on('*', (event, properties, origin) => {
		yjsTrace('nodes.on', `${event}  ${JSON.stringify(properties.items)} origin: ${origin} dontUndo: ${dontUndo}`)
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					// this is a local change
					if (event == 'remove') {
						yNodesMap.delete(id.toString())
					} else {
						yNodesMap.set(id.toString(), deepCopy(nodes.get(id)))
					}
				}
			})
		}, dontUndo)
		dontUndo = null
	})
	/* 
	yNodesMap.observe listens for changes in the yMap, receiving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node and all links to/from it are
	removed from the local nodes dataSet. Otherwise, if the received node differs from the local one, 
	the local node dataSet is updated (which includes adding a new node if it does not already exist locally).
	 */
	yNodesMap.observe((event) => {
		yjsTrace('yNodesMap.observe', event)
		let nodesToUpdate = []
		let nodesToRemove = []
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key)
				if (!object_equals(obj, data.nodes.get(key))) {
					nodesToUpdate.push(deepCopy(obj))
					// if a note on a node is being remotely edited and is on display here, update the local note and the padlock
					if (editor && editor.id == key && event.transaction.local === false) {
						editor.setContents(obj.note)
						elem('fixed').style.display = obj.fixed ? 'inline' : 'none'
						elem('unfixed').style.display = obj.fixed ? 'none' : 'inline'
					}
				}
			} else {
				hideNotes()
				if (data.nodes.get(key)) network.getConnectedEdges(key).forEach((edge) => nodesToRemove.push(edge))
				nodesToRemove.push(key)
			}
		}
		if (nodesToUpdate.length > 0) nodes.update(nodesToUpdate, 'remote')
		if (nodesToRemove.length > 0) nodes.remove(nodesToRemove, 'remote')
		if (/changes/.test(debug) && (nodesToUpdate.length > 0 || nodesToRemove.length > 0))
			showChange(event, yNodesMap)
	})
	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties, origin) => {
		yjsTrace('edges.on', `${event}  ${JSON.stringify(properties.items)} origin: ${origin}`)
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					if (event == 'remove') yEdgesMap.delete(id.toString())
					else {
						yEdgesMap.set(id.toString(), deepCopy(edges.get(id)))
					}
				}
			})
		}, dontUndo)
		dontUndo = null
	})
	yEdgesMap.observe((event) => {
		yjsTrace('yEdgesMap.observe', event)
		let edgesToUpdate = []
		let edgesToRemove = []
		for (let key of event.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key)
				if (!object_equals(obj, data.edges.get(key))) {
					edgesToUpdate.push(deepCopy(obj))
					if (editor && editor.id == key && event.transaction.local === false) editor.setContents(obj.note)
				}
			} else {
				hideNotes()
				edgesToRemove.push(key)
			}
		}
		if (edgesToUpdate.length > 0) edges.update(edgesToUpdate, 'remote')
		if (edgesToRemove.length > 0) edges.remove(edgesToRemove, 'remote')
		if (/changes/.test(debug) && (edgesToUpdate.length > 0 || edgesToRemove.length > 0))
			showChange(event, yEdgesMap)
	})
	/**
	 * utility trace function that prints the change in the value of a YMap property to the console
	 * @param {YEvent} event
	 * @param {MapType} ymap
	 */
	function showChange(event, ymap) {
		event.changes.keys.forEach((change, key) => {
			if (change.action === 'add') {
				console.log(
					`Property "${key}" was added. 
				Initial value: `,
					ymap.get(key)
				)
			} else if (change.action === 'update') {
				console.log(
					`Property "${key}" was updated. 
					New value: "`,
					ymap.get(key),
					`"
					Previous value: "`,
					change.oldValue,
					`" 
					Difference: "`,
					typeof change.oldValue === 'object' && typeof ymap.get(key) === 'object'
						? diff(change.oldValue, ymap.get(key))
						: change.oldValue + ' ' + ymap.get(key),
					`"`
				)
			} else if (change.action === 'delete') {
				console.log(
					`Property "${key}" was deleted. 
				Previous value: `,
					change.oldValue
				)
			}
		})
	}
	ySamplesMap.observe((event) => {
		yjsTrace('ySamplesMap.observe', event)
		let nodesToUpdate = []
		let edgesToUpdate = []
		for (let key of event.keysChanged) {
			let sample = ySamplesMap.get(key)
			if (sample.node !== undefined) {
				if (!object_equals(styles.nodes[key], sample.node)) {
					styles.nodes[key] = sample.node
					nodesToUpdate.push(key)
				}
			} else {
				if (!object_equals(styles.edges[key], sample.edge)) {
					styles.edges[key] = sample.edge
					edgesToUpdate.push(key)
				}
			}
		}
		if (nodesToUpdate) {
			refreshSampleNodes()
			reApplySampleToNodes(nodesToUpdate)
		}
		if (edgesToUpdate) {
			refreshSampleLinks()
			reApplySampleToLinks(edgesToUpdate)
		}
	})
	/*
	Map controls (those on the Network tab) are of three kinds:
	1. Those that affect only the local map and are not promulgated to other users
	e.g zoom, show drawing layer, show history
	2. Those where the control status (e.g. whether a switch is on or off) is promulgated,
	but the effect of the switch is handled by yNodesMap and yEdgesMap (e.g. Show Factors
		x links away; Size Factors to)
	3. Those whose effects are promulgated and switches controlled here by yNetMap (e.g
		Background)
	For cases 2 and 3, the functions called here must not invoke yNetMap.set() to avoid loops
	*/
	yNetMap.observe((event) => {
		yjsTrace('YNetMap.observe', event)

		if (event.transaction.local === false)
			for (let key of event.keysChanged) {
				let obj = yNetMap.get(key)
				switch (key) {
					case 'mapTitle':
					case 'maptitle':
						setMapTitle(obj)
						break
					case 'snapToGrid':
						doSnapToGrid(obj)
						break
					case 'curve':
						setCurve(obj)
						break
					case 'background':
						setBackground(obj)
						break
					case 'legend':
						setLegend(obj, false)
						break
					case 'showNotes':
						doShowNotes(obj)
						break
					case 'radius':
						hiddenNodes.radiusSetting = obj.radiusSetting
						hiddenNodes.selected = obj.selected
						setAnalysisButtonsFromRemote()
						break
					case 'stream':
						hiddenNodes.streamSetting = obj.streamSetting
						hiddenNodes.selected = obj.selected
						setAnalysisButtonsFromRemote()
						break
					case 'paths':
						hiddenNodes.pathsSetting = obj.pathsSetting
						hiddenNodes.selected = obj.selected
						setAnalysisButtonsFromRemote()
						break
					case 'sizing':
						sizing(obj)
						break
					case 'hideAndStream':
					case 'linkRadius':
						// old settings (before v1.6) - ignore
						break
					case 'factorsHiddenByStyle':
						updateFactorsHiddenByStyle(obj)
						break
					case 'attributeTitles':
						recreateClusteringMenu(obj)
						break
					case 'cluster':
						setCluster(obj)
						break
					default:
						console.log('Bad key in yMapNet.observe: ', key)
				}
			}
	})
	yPointsArray.observe((event) => {
		yjsTrace('yPointsArray.observe', yPointsArray.get(yPointsArray.length - 1))
		if (event.transaction.local === false) network.redraw()
	})
	yHistory.observe(() => {
		yjsTrace('yHistory.observe', yHistory.get(yHistory.length - 1))
		if (elem('showHistorySwitch').checked) showHistory()
	})
	yUndoManager.on('stack-item-added', (event) => {
		yjsTrace('yUndoManager.on stack-item-added', event)
		if (/changes/.test(debug))
			event.changedParentTypes.forEach((v) => {
				showChange(v[0], v[0].target)
			})
		undoRedoButtonStatus()
	})
	yUndoManager.on('stack-item-popped', (event) => {
		yjsTrace('yUndoManager.on stack-item-popped', event)
		if (/changes/.test(debug))
			event.changedParentTypes.forEach((v) => {
				showChange(v[0], v[0].target)
			})
		undoRedoButtonStatus()
	})
} // end startY()

function yjsTrace(where, what) {
	if (/yjs/.test(debug)) {
		console.log(exactTime(), where, what)
	}
}
/**
 * create a random string of the form AAA-BBB-CCC-DDD
 */
function generateRoom() {
	let room = ''
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 3; j++) {
			room += String.fromCharCode(65 + Math.floor(Math.random() * 26))
		}
		if (i < 3) room += '-'
	}
	return room
}

/**
 * randomly create some nodes and edges as a binary tree, mainly used for testing
 * @param {number} nNodes
 */
function getRandomData(nNodes) {
	let SFNdata = getScaleFreeNetwork(nNodes)
	nodes.add(SFNdata.nodes)
	edges.add(SFNdata.edges)
	reApplySampleToNodes(['group0'])
	reApplySampleToLinks(['edge0'])
	recalculateStats()
}
/**
 * Once any existing map has been loaded, fit it to the pane and reveal it
 * @param {string} msg message for console
 */
function displayNetPane(msg) {
	console.log(msg)
	if (netPane.style.visibility == 'hidden' || netPane.style.visibility == '') {
		elem('loading').style.display = 'none'
		fit(0)
		setMapTitle(yNetMap.get('mapTitle'))
		netPane.style.visibility = 'visible'
		clearTimeout(loadingDelayTimer)
		yUndoManager.clear()
		undoRedoButtonStatus()
		setUpTutorial()
		netLoaded = true
		savedState = compressToUTF16(
			JSON.stringify({nodes: data.nodes.get(), edges: data.edges.get(), net: yNetMap.toJSON()})
		)
		setAnalysisButtonsFromRemote()
		toggleDeleteButton()
		setLegend(yNetMap.get('legend'), false)
	}
}

// to handle iPad viewport sizing problem when tab bar appears and to keep panels on screen
setvh()

window.onresize = function () {
	setvh()
	keepPaneInWindow(panel)
	keepPaneInWindow(elem('chatbox-holder'))
}
window.onorientationchange = function () {
	setvh()
}
/**
 * to handle iOS weirdness in fixing the vh unit (see https://css-tricks.com/the-trick-to-viewport-units-on-mobile/)
 */
function setvh() {
	document.body.height = window.innerHeight
	// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
	let vh = window.innerHeight * 0.01
	// Then we set the value in the --vh custom property to the root of the document
	document.documentElement.style.setProperty('--vh', `${vh}px`)
}

const chatbox = elem('chatbox')
const chatboxTab = elem('chatbox-tab')
const chatNameBox = elem('chat-name')
const chatInput = elem('chat-input')
const chatSend = elem('send-button')
const chatMessages = elem('chat-messages')

/**
 * create DOM elements for the chat box
 */
function setUpChat() {
	try {
		myNameRec = JSON.parse(localStorage.getItem('myName'))
	} catch (err) {
		myNameRec = null
	}
	// sanity check
	if (!(myNameRec != null && myNameRec.name)) {
		myNameRec = generateName()
		localStorage.setItem('myName', JSON.stringify(myNameRec))
	}
	myNameRec.id = clientID

	console.log('My name: ' + myNameRec.name)
	displayUserName()
	yAwareness.setLocalState({user: myNameRec})
	yChatArray.observe(() => {
		displayLastMsg()
	})
	chatboxTab.addEventListener('click', maximize)
	listen('minimize', 'click', minimize)
	chatNameBox.addEventListener('keyup', (e) => {
		if (myNameRec.anon) chatNameBox.style.fontStyle = 'normal'
		if (e.key == 'Enter') saveUserName(chatNameBox.value)
	})
	chatNameBox.addEventListener('blur', () => {
		saveUserName(chatNameBox.value)
	})
	chatNameBox.addEventListener('click', () => {
		if (myNameRec.anon) chatNameBox.value = ''
		chatNameBox.focus()
		chatNameBox.select()
	})
	chatSend.addEventListener('click', sendMsg)
}
function saveUserName(name) {
	if (name.length > 0) {
		myNameRec.name = name
		myNameRec.anon = false
	} else {
		myNameRec = generateName()
		chatNameBox.value = myNameRec.name
	}
	myNameRec.id = clientID
	localStorage.setItem('myName', JSON.stringify(myNameRec))
	yAwareness.setLocalState({user: myNameRec})
	showAvatars()
}
/**
 * if this is the user's first time, show them how the user interface works
 */
function setUpTutorial() {
	if (localStorage.getItem('doneIntro') !== 'done' && viewOnly === false) {
		tutorial.onexit(function () {
			localStorage.setItem('doneIntro', 'done')
		})
		tutorial.onstep(0, () => {
			let splashNameBox = elem('splashNameBox')
			let anonName = myNameRec.name || generateName().name
			splashNameBox.placeholder = anonName
			splashNameBox.focus()
			splashNameBox.addEventListener('blur', () => {
				saveUserName(splashNameBox.value || anonName)
				displayUserName()
			})
			splashNameBox.addEventListener('keyup', (e) => {
				if (e.key == 'Enter') splashNameBox.blur()
			})
		})
		tutorial.start()
	}
}

/**
 * draw the network, after setting the vis-network options
 */
function draw() {
	// for testing, you can append ?t=XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let url = new URL(document.location)
	let nNodes = parseInt(url.searchParams.get('t'))
	if (nNodes) getRandomData(nNodes)
	// create a network
	var options = {
		nodes: {
			chosen: {
				node: function (values, id, selected) {
					if (selected) values.shadow = true
				},
			},
		},
		edges: {
			chosen: {
				edge: function (values, id, selected) {
					if (selected) values.shadow = true
				},
			},
			smooth: {
				type: 'straightCross',
			},
		},
		physics: {
			enabled: false,
			stabilization: false,
		},
		interaction: {
			multiselect: true,
			selectConnectedEdges: false,
			hover: false,
			hoverConnectedEdges: false,
			zoomView: false,
			tooltipDelay: 0,
		},
		manipulation: {
			enabled: false,
			addNode: function (item, callback) {
				item.label = ''
				item = deepMerge(item, styles.nodes[lastNodeSample])
				item.grp = lastNodeSample
				item.created = timestamp()
				addLabel(item, cancelAdd, callback)
				showPressed('addNode', 'remove')
			},
			editNode: function (item, callback) {
				// for some weird reason, vis-network copies the group properties into the
				// node properties before calling this fn, which we don't want.  So we
				// revert to using the original node properties before continuing.
				item = data.nodes.get(item.id)
				item.modified = timestamp()
				let point = {x: event.offsetX, y: event.offsetY}
				editNode(item, point, cancelEdit, callback)
			},
			addEdge: function (item, callback) {
				inAddMode = false
				network.setOptions({
					interaction: {dragView: true, selectable: true},
				})
				showPressed('addLink', 'remove')
				if (item.from == item.to) {
					callback(null)
					stopEdit()
					return
				}
				if (duplEdge(item.from, item.to).length > 0) {
					statusMsg('There is already a link from this Factor to the other.', 'error')
					callback(null)
					stopEdit()
					return
				}
				if (data.nodes.get(item.from).isCluster || data.nodes.get(item.to).isCluster) {
					statusMsg('Links cannot be made to or from a cluster', 'error')
					callback(null)
					stopEdit()
					return
				}
				item = deepMerge(item, styles.edges[lastLinkSample])
				item.grp = lastLinkSample
				item.created = timestamp()
				clearStatusBar()
				callback(item)
				logHistory(`added link from '${data.nodes.get(item.from).label}' to '${data.nodes.get(item.to).label}'`)
			},
			editEdge: {
				editWithoutDrag: function (item, callback) {
					item = data.edges.get(item.id)
					item.modified = timestamp()
					let point = {x: event.offsetX, y: event.offsetY}
					editEdge(item, point, cancelEdit, callback)
				},
			},
			deleteNode: function (item, callback) {
				let locked = false
				item.nodes.forEach((nId) => {
					let n = data.nodes.get(nId)
					if (n.locked) {
						locked = true
						statusMsg(`Factor '${shorten(n.oldLabel)}' can't be deleted because it is locked`, 'warn')
						callback(null)
						return
					}
				})
				if (locked) return
				clearStatusBar()
				hideNotes()
				// delete also all the edges that link to the nodes being deleted
				item.nodes.forEach((nId) => {
					network.getConnectedEdges(nId).forEach((eId) => {
						if (item.edges.indexOf(eId) === -1) item.edges.push(eId)
					})
				})
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from '${data.nodes.get(data.edges.get(edgeId).from).label}' to '${
							data.nodes.get(data.edges.get(edgeId).to).label
						}'`
					)
				})
				item.nodes.forEach((nodeId) => {
					logHistory(`deleted factor: '${data.nodes.get(nodeId).label}'`)
				})
				callback(item)
			},
			deleteEdge: function (item, callback) {
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from '${data.nodes.get(data.edges.get(edgeId).from).label}' to '${
							data.nodes.get(data.edges.get(edgeId).to).label
						}'`
					)
				})
				callback(item)
			},
			controlNodeStyle: {
				shape: 'dot',
				color: 'red',
				size: 5,
				group: undefined,
			},
		},
	}
	if (viewOnly)
		options.interaction = {
			dragNodes: false,
			hover: false,
		}
	network = new Network(netPane, data, options)
	window.network = network
	elem('zoom').value = network.getScale()

	// start with factor tab open, but hidden
	elem('nodesButton').click()

	// listen for click events on the network pane
	network.on('click', (params) => {
		if (/gui/.test(debug)) console.log('**click**')
		let keys = params.event.pointers[0]
		if (!keys) return
		if (keys.metaKey) {
			// if the Command key (on a Mac) is down, and the click is on a node/edge, log it to the console
			if (params.nodes.length == 1) {
				let node = data.nodes.get(params.nodes[0])
				console.log('node = ', node)
				window.node = node
			}
			if (params.edges.length == 1) {
				let edge = data.edges.get(params.edges[0])
				console.log('edge = ', edge)
				window.edge = edge
			}
			return
		}
		if (keys.altKey) {
			// if the Option/ALT key is down, add a node if on the background
			if (params.nodes.length == 0 && params.edges.length == 0) {
				let pos = params.pointer.canvas
				let item = {id: uuidv4(), label: '', x: pos.x, y: pos.y}
				item = deepMerge(item, styles.nodes[lastNodeSample])
				item.grp = lastNodeSample
				addLabel(item, clearPopUp, function (newItem) {
					if (newItem !== null) data.nodes.add(newItem)
				})
			}
			return
		}
		if (keys.shiftKey) {
			if (!inEditMode) showMagnifier(keys)
		}
	})

	// despatch to edit a node or an edge or to fit the network on the pane
	network.on('doubleClick', function (params) {
		if (/gui/.test(debug)) console.log('**doubleClick**')
		if (params.nodes.length === 1) {
			if (!viewOnly && !inEditMode) network.editNode()
		} else if (params.edges.length === 1) {
			if (!viewOnly && !inEditMode) network.editEdgeMode()
		} else {
			fit()
		}
	})
	network.on('selectNode', function () {
		if (/gui/.test(debug)) console.log('selectNode')
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
		if (getRadioVal('radio') !== 'All') analyse()
		if (getRadioVal('stream') !== 'All') analyse()
		if (getRadioVal('paths') !== 'All') analyse()
	})
	network.on('deselectNode', function () {
		if (/gui/.test(debug)) console.log('deselectNode')
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
		if (getRadioVal('radio') !== 'All') analyse()
		if (getRadioVal('stream') !== 'All') analyse()
		if (getRadioVal('paths') !== 'All') analyse()
	})
	network.on('hoverNode', function () {
		changeCursor('grab')
	})
	network.on('blurNode', function () {
		changeCursor('default')
	})
	network.on('selectEdge', function () {
		if (/gui/.test(debug)) console.log('selectEdge')
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
	})
	network.on('deselectEdge', function () {
		if (/gui/.test(debug)) console.log('deselectEdge')
		hideNotes()
		showSelected()
		toggleDeleteButton()
	})
	network.on('oncontext', function (e) {
		let nodeId = network.getNodeAt(e.pointer.DOM)
		if (nodeId) openCluster(nodeId)
	})

	let selectionCanvasStart = {}
	let selectionStart = {}
	let selectionArea = document.createElement('div')
	selectionArea.className = 'selectionBox'
	selectionArea.style.display = 'none'
	elem('main').appendChild(selectionArea)

	network.on('dragStart', function (params) {
		if (/gui/.test(debug)) console.log('dragStart')
		let e = params.event.pointers[0]
		// start drawing a selection rectangle if the CTRL key is down and click is on the background
		if (e.ctrlKey && params.nodes.length == 0 && params.edges.length == 0) {
			network.setOptions({interaction: {dragView: false}})
			listen('net-pane', 'mousemove', showAreaSelection)
			selectionStart = {x: e.offsetX, y: e.offsetY}
			selectionCanvasStart = params.pointer.canvas
			selectionArea.style.left = `${e.offsetX}px`
			selectionArea.style.top = `${e.offsetY}px`
			selectionArea.style.width = '0px'
			selectionArea.style.height = '0px'
			selectionArea.style.display = 'block'
			return
		}
		if (e.altKey) {
			if (!inAddMode) {
				removeFactorCursor()
				changeCursor('crosshair')
				inAddMode = 'addLink'
				showPressed('addLink', 'add')
				statusMsg('Now drag to the middle of the Destination factor')
				network.setOptions({
					interaction: {dragView: false, selectable: false},
				})
				network.addEdgeMode()
				return
			}
		}
		changeCursor('grabbing')
	})
	/**
	 * update the selection rectangle as the mouse moves
	 * @param {Event} event
	 */
	function showAreaSelection(event) {
		selectionArea.style.left = `${Math.min(selectionStart.x, event.offsetX)}px`
		selectionArea.style.top = `${Math.min(selectionStart.y, event.offsetY)}px`
		selectionArea.style.width = `${
			Math.max(selectionStart.x, event.offsetX) - Math.min(selectionStart.x, event.offsetX)
		}px`
		selectionArea.style.height = `${
			Math.max(selectionStart.y, event.offsetY) - Math.min(selectionStart.y, event.offsetY)
		}px`
	}
	network.on('dragEnd', function (params) {
		if (/gui/.test(debug)) console.log('dragEnd')
		if (selectionArea.style.display == 'block') {
			selectionArea.style.display = 'none'
			network.setOptions({interaction: {dragView: true}})
			elem('net-pane').removeEventListener('mousemove', showAreaSelection)
		}
		let e = params.event.pointers[0]
		if (e.ctrlKey && params.nodes.length == 0 && params.edges.length == 0) {
			network.storePositions()
			let selectionEnd = params.pointer.canvas
			let selectedNodes = data.nodes.get({
				filter: function (node) {
					return (
						!node.hidden &&
						node.x >= selectionCanvasStart.x &&
						node.x <= selectionEnd.x &&
						node.y >= selectionCanvasStart.y &&
						node.y <= selectionEnd.y
					)
				},
			})
			network.setSelection({nodes: selectedNodes.map((n) => n.id).concat(network.getSelectedNodes())})
			showSelected()
			return
		}
		let newPositions = network.getPositions(params.nodes)
		data.nodes.update(
			data.nodes.get(params.nodes).map((n) => {
				n.x = newPositions[n.id].x
				n.y = newPositions[n.id].y
				if (snapToGridToggle) snapToGrid(n)
				return n
			})
		)
		changeCursor('default')
	})
	network.on('controlNodeDragging', function () {
		if (/gui/.test(debug)) console.log('controlNodeDragging')
		changeCursor('crosshair')
	})
	network.on('controlNodeDragEnd', function (event) {
		if (/gui/.test(debug)) console.log('controlNodeDragEnd')
		if (event.controlEdge.from != event.controlEdge.to) changeCursor('default')
	})
	network.on('beforeDrawing', function (ctx) {
		redraw(ctx)
	})
	network.on('afterDrawing', (ctx) => drawBadges(ctx))

	// listen for changes to the network structure
	// and recalculate the network statistics when there is one
	data.nodes.on('add', recalculateStats)
	data.nodes.on('remove', recalculateStats)
	data.edges.on('add', recalculateStats)
	data.edges.on('remove', recalculateStats)

	/* --------------------------------------------set up the magnifier --------------------------------------------*/
	const magSize = 300 // diameter of loupe
	const halfMagSize = magSize / 2.0
	const netPaneCanvas = netPane.firstElementChild.firstElementChild
	let magnifier = document.createElement('canvas')
	magnifier.width = magSize
	magnifier.height = magSize
	magnifier.className = 'magnifier'
	let magnifierCtx = magnifier.getContext('2d')
	magnifierCtx.fillStyle = 'white'
	netPane.appendChild(magnifier)
	let bigNetPane = null
	let bigNetwork = null
	let bigNetCanvas = null
	let netPaneRect = null

	window.addEventListener('keydown', (e) => {
		if (!inEditMode && e.shiftKey) createMagnifier()
	})
	window.addEventListener('mousemove', (e) => {
		if (e.shiftKey) showMagnifier(e)
	})
	window.addEventListener('keyup', (e) => {
		if (e.key == 'Shift') closeMagnifier()
	})

	/**
	 * create a copy of the network, but magnified and off screen
	 */
	function createMagnifier() {
		if (bigNetPane) {
			bigNetwork.destroy()
			bigNetPane.remove()
		}
		netPaneRect = netPane.getBoundingClientRect()
		network.storePositions()
		bigNetPane = document.createElement('div')
		bigNetPane.id = 'big-net-pane'
		bigNetPane.style.position = 'absolute'
		bigNetPane.style.top = '-9999px'
		bigNetPane.style.left = '-9999px'
		bigNetPane.style.width = `${netPane.offsetWidth * magnification}px`
		bigNetPane.style.height = `${netPane.offsetHeight * magnification}px`
		netPane.appendChild(bigNetPane)
		bigNetwork = new Network(bigNetPane, data, {
			physics: {enabled: false},
		})
		bigNetCanvas = bigNetPane.firstElementChild.firstElementChild
		bigNetwork.moveTo({
			position: network.getViewPosition(),
			scale: magnification * network.getScale(),
		})
		netPane.style.cursor = 'none'
		magnifier.style.display = 'none'
	}
	/**
	 * display the loupe, centred on the mouse pointer, and fill it with
	 * an image copied from the magnified network
	 */
	function showMagnifier(e) {
		e.preventDefault()
		if (bigNetCanvas == null) createMagnifier()
		magnifierCtx.fillRect(0, 0, magSize, magSize)
		magnifierCtx.drawImage(
			bigNetCanvas,
			((e.clientX - netPaneRect.x) * bigNetCanvas.width) / netPaneCanvas.clientWidth - halfMagSize,
			((e.clientY - netPaneRect.y) * bigNetCanvas.height) / netPaneCanvas.clientHeight - halfMagSize,
			magSize,
			magSize,
			0,
			0,
			magSize,
			magSize
		)
		magnifier.style.top = e.clientY - netPaneRect.y - halfMagSize + 'px'
		magnifier.style.left = e.clientX - netPaneRect.x - halfMagSize + 'px'
		magnifier.style.display = 'block'
	}
	/**
	 * destroy the magnified network copy
	 */
	function closeMagnifier() {
		if (bigNetPane) {
			bigNetwork.destroy()
			bigNetPane.remove()
		}
		netPane.style.cursor = 'default'
		magnifier.style.display = 'none'
	}
} // end draw()

/**
 * un fade the delete button to show that it can be used when something is selected
 */
function toggleDeleteButton() {
	if (network.getSelectedNodes().length > 0 || network.getSelectedEdges().length > 0)
		elem('deleteNode').classList.remove('disabled')
	else elem('deleteNode').classList.add('disabled')
}

function contextMenu(event) {
	event.preventDefault()
}
/**
 * return an object with the current time as a date an integer and the current user's name
 */
function timestamp() {
	return {time: Date.now(), user: myNameRec.name}
}
/**
 * push a record that action has been taken on to the end of the history log
 *  also record current state of the map for possible roll back
 *  and note changes have been made to the map
 * @param {String} action
 */
export function logHistory(action, actor) {
	yHistory.push([
		{
			action: action,
			time: Date.now(),
			user: actor ? actor : myNameRec.name,
			state: savedState,
		},
	])
	savedState = compressToUTF16(
		JSON.stringify({nodes: data.nodes.get(), edges: data.edges.get(), net: yNetMap.toJSON()})
	)
	// delete all but the last 10 saved states
	for (let i = 0; i < yHistory.length - 10; i++) {
		let obj = yHistory.get(i)
		if (obj.state) {
			obj.state = null
			yHistory.delete(i)
			yHistory.insert(i, [obj])
		}
	}
	if (elem('history-window').style.display == 'block') showHistory()
	dirty = true
}
/**
 * draw badges (icons) around Factors and Links
 * @param {CanvasRenderingContext2D} ctx NetPane canvas context
 */
function drawBadges(ctx) {
	// padlock for locked factors
	data.nodes
		.get()
		.filter((node) => !node.hidden && node.fixed)
		.forEach((node) => {
			let box = network.getBoundingBox(node.id)
			drawLockBadge(ctx, box.left - 10, box.top)
		})
	if (!showNotesToggle) return
	// note card for Factors and Links with Notes
	data.nodes
		.get()
		.filter((node) => !node.hidden && node.note && node.note != 'Notes')
		.forEach((node) => {
			let box = network.getBoundingBox(node.id)
			drawNoteBadge(ctx, box.right, box.top)
		})
	let changedEdges = []
	data.edges.get().forEach((edge) => {
		if (
			!edge.hidden &&
			edge.note &&
			edge.note != 'Notes' &&
			edge.arrows &&
			edge.arrows.middle &&
			!edge.arrows.middle.enabled
		) {
			// there is a note, but the badge is not shown
			changedEdges.push(edge)
			edge.arrows.middle.enabled = true
			edge.arrows.middle.type = 'image'
			edge.arrows.middle.src = noteImage.src
		} else if (
			(!edge.note || (edge.note && edge.note == 'Notes')) &&
			edge.arrows &&
			edge.arrows.middle &&
			edge.arrows.middle.enabled
		) {
			// there is not a note, but the badge is shown
			changedEdges.push(edge)
			edge.arrows.middle.enabled = false
		}
	})
	data.edges.update(changedEdges)
}
function drawNoteBadge(ctx, x, y) {
	ctx.beginPath()
	ctx.drawImage(noteImage, Math.floor(x), Math.floor(y))
}

var noteImage = new Image()
noteImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktY2FyZC10ZXh0IiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik0xNC41IDNhLjUuNSAwIDAgMSAuNS41djlhLjUuNSAwIDAgMS0uNS41aC0xM2EuNS41IDAgMCAxLS41LS41di05YS41LjUgMCAwIDEgLjUtLjVoMTN6bS0xMy0xQTEuNSAxLjUgMCAwIDAgMCAzLjV2OUExLjUgMS41IDAgMCAwIDEuNSAxNGgxM2ExLjUgMS41IDAgMCAwIDEuNS0xLjV2LTlBMS41IDEuNSAwIDAgMCAxNC41IDJoLTEzeiIvPgogIDxwYXRoIGQ9Ik0zIDUuNWEuNS41IDAgMCAxIC41LS41aDlhLjUuNSAwIDAgMSAwIDFoLTlhLjUuNSAwIDAgMS0uNS0uNXpNMyA4YS41LjUgMCAwIDEgLjUtLjVoOWEuNS41IDAgMCAxIDAgMWgtOUEuNS41IDAgMCAxIDMgOHptMCAyLjVhLjUuNSAwIDAgMSAuNS0uNWg2YS41LjUgMCAwIDEgMCAxaC02YS41LjUgMCAwIDEtLjUtLjV6Ii8+Cjwvc3ZnPg=='
var lockImage = new Image()
lockImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktbG9jay1maWxsIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik04IDFhMiAyIDAgMCAxIDIgMnY0SDZWM2EyIDIgMCAwIDEgMi0yem0zIDZWM2EzIDMgMCAwIDAtNiAwdjRhMiAyIDAgMCAwLTIgMnY1YTIgMiAwIDAgMCAyIDJoNmEyIDIgMCAwIDAgMi0yVjlhMiAyIDAgMCAwLTItMnoiLz4KPC9zdmc+'

function drawLockBadge(ctx, x, y) {
	ctx.beginPath()
	ctx.drawImage(lockImage, Math.floor(x), Math.floor(y))
}

/**
 * rescale and redraw the network so that it fits the pane
 * @param {number} duration speed of zoom to fit
 */
function fit(duration = 200) {
	network.fit({
		position: {x: 0, y: 0},
		animation: {duration: duration, easingFunction: 'linear'},
	})
	let newScale = network.getScale()
	elem('zoom').value = newScale
	network.storePositions()
}

/**
 * Move the node to the nearest spot that it on the grid
 * @param {object} node
 */
function snapToGrid(node) {
	node.x = GRIDSPACING * Math.round(node.x / GRIDSPACING)
	node.y = GRIDSPACING * Math.round(node.y / GRIDSPACING)
}
/**
 * Copy the selected nodes and links to the clipboard
 * NB this doesn't yet work in Firefox, as they haven't implemented the Clipboard API and Permissions yet.
 * @param {Event} event
 */
function copyToClipboard(event) {
	if (document.getSelection().toString()) return // only copy factors if there is no text selected (e.g. in Notes)
	event.preventDefault()
	let nIds = getSelectedAndFixedNodes()
	let eIds = network.getSelectedEdges()
	if (nIds.length + eIds.length == 0) {
		statusMsg('Nothing selected to copy', 'warn')
		return
	}
	let nodes = []
	let edges = []
	nIds.forEach((nId) => {
		nodes.push(data.nodes.get(nId))
		let edgesFromNode = network.getConnectedEdges(nId)
		edgesFromNode.forEach((eId) => {
			let edge = data.edges.get(eId)
			if (nIds.includes(edge.to) && nIds.includes(edge.from) && !edges.find((e) => e.id == eId)) edges.push(edge)
		})
	})
	eIds.forEach((eId) => {
		let edge = data.edges.get(eId)
		if (!nodes.find((n) => n.id == edge.from)) nodes.push(data.nodes.get(edge.from))
		if (!nodes.find((n) => n.id == edge.to)) nodes.push(data.nodes.get(edge.to))
		if (!edges.find((e) => e.id == eId)) edges.push(data.edges.get(eId))
	})
	copyText(JSON.stringify({nodes: nodes, edges: edges}))
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch (err) {
		console.error('Failed to copy: ', err)
		statusMsg('Copy failed', 'error')
		return false
	}
}

async function pasteFromClipboard() {
	let clip = await getClipboardContents()
	let nodes, edges
	try {
		;({nodes, edges} = JSON.parse(clip))
	} catch (err) {
		// silently return (i.e. use system paste) if there is nothing relevant on the clipboard
		return
	}
	unSelect()
	nodes.forEach((node) => {
		let oldId = node.id
		node.id = uuidv4()
		node.x += 40
		node.y += 40
		edges.forEach((edge) => {
			if (edge.from == oldId) edge.from = node.id
			if (edge.to == oldId) edge.to = node.id
		})
	})
	edges.forEach((edge) => {
		edge.id = uuidv4()
	})
	data.nodes.add(nodes)
	data.edges.add(edges)
	network.setSelection({nodes: nodes.map((n) => n.id), edges: edges.map((e) => e.id)})
	showSelected()
}

async function getClipboardContents() {
	try {
		return await navigator.clipboard.readText()
	} catch (err) {
		console.error('Failed to read clipboard contents: ', err)
		statusMsg('Failed to paste', 'error')
		return null
	}
}

/* ----------------- dialogs for creating and editing nodes and links ----------------*/

/**
 * A factor is being created:  get its label from the user
 * @param {Object} item - the node
 * @param {Function} cancelAction
 * @param {Function} callback
 */
function addLabel(item, cancelAction, callback) {
	initPopUp('Add Factor', 60, item, cancelAction, saveLabel, callback)
	let pos = {x: event.offsetX, y: event.offsetY}
	positionPopUp(pos)
	removeFactorCursor()
	ghostFactor(pos)
	elem('popup-label').focus()
}
/**
 * broadcast to other users that a new factor is being added here
 * @param {Object} pos offset coordinates of Add Factor dialog
 */
function ghostFactor(pos) {
	yAwareness.setLocalStateField('addingFactor', network.DOMtoCanvas(pos))
	elem('popup').timer = setTimeout(() => {
		// close it after a time if the user has gone away
		yAwareness.setLocalStateField('addingFactor', 'done')
	}, TIMETOEDIT)
}

/**
 * Draw a dialog box for user to edit a node
 * @param {Object} item the node
 * @param {Object} point the centre of the node
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editNode(item, point, cancelAction, callback) {
	initPopUp('Edit Factor', 150, item, cancelAction, saveNode, callback)
	elem('popup').insertAdjacentHTML(
		'beforeend',
		`	
	<table id="popup-table">
		<tr>
			<td>
				<i>Back</i>
			</td>
			<td>
			<i>Border</i>
			</td>
			<td>
			<i>Font</i>
			</td>
		</tr>
		<tr>
		<td>
		<div class="input-color-container">
		<div class="color-well" id="node-backgroundColor" </div>
		</div>
		</td>
		<td>
			<div class="input-color-container">
			<div class="color-well" id="node-borderColor" </div>
			</div>
			</td>
			<td>
			<div class="input-color-container">
			<div class="color-well" id="node-fontColor" </div>
			</div>
			</td>
		</tr>
		<tr>
		<td><i>Border:</i></td>
			<td colspan="2">
				<select id="node-borderType">
					<option value="false">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
					<option value="none">None</option>
				</select>
			</td>
		</tr>
	</table>`
	)
	cp.createColorPicker('node-backgroundColor')
	elem('node-backgroundColor').style.backgroundColor = standardize_color(item.color.background)
	cp.createColorPicker('node-borderColor')
	elem('node-borderColor').style.backgroundColor = standardize_color(item.color.border)
	cp.createColorPicker('node-fontColor')
	elem('node-fontColor').style.backgroundColor = standardize_color(item.font.color)
	elem('node-borderType').value = getDashes(item.shapeProperties.borderDashes, item.borderWidth)
	positionPopUp(point)
	elem('popup-label').focus()
	elem('popup').timer = setTimeout(() => {
		//ensure that the node cannot be locked out for ever
		cancelEdit(item, callback)
		statusMsg('Edit timed out', 'warn')
	}, TIMETOEDIT)
	lockNode(item)
}
/**
 * Convert CSS description of line type to menu option format
 * true, false, [3 3] => "true", "false", "dots", "none"
 * @param {array|boolean} val
 * @param {number} width
 */
function getDashes(val, width) {
	if (Array.isArray(val)) return 'dots'
	if (width == 0) return 'none'
	return val.toString()
}
/**
 * Draw a dialog box for user to edit an edge
 * @param {Object} item the edge
 * @param {Object} point the centre of the edge
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editEdge(item, point, cancelAction, callback) {
	initPopUp('Edit Link', 150, item, cancelAction, saveEdge, callback)
	elem('popup').insertAdjacentHTML(
		'beforeend',
		` 
		<table id="popup-table">
		<tr>
			<td>
				<select id="edge-width">
					<option value="">Width...</option>
					<option value="1">Width: 1</option>
					<option value="2">Width: 2</option>
					<option value="4">Width: 4</option>
				</select>
			</td>
			<td>
				<select id="edge-type">
					<option value="false">Line...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>
				<select id="edge-arrow">
					<option value="vee">Arrows...</option>
					<option value="vee">Sharp</option>
					<option value="arrow">Triangle</option>
					<option value="bar">Bar</option>
					<option value="circle">Circle</option>
					<option value="box">Box</option>
					<option value="diamond">Diamond</option>
					<option value="none">None</option>
				</select>
			</td>
			<td>
				<div class="input-color-container">
					<div class="color-well"  id="edge-color" </div>
				</div>
			</td>
		</tr>
		<tr>
			<td style="text-align: right; padding-top: 5px">
				<i>Font</i>	
			</td>
			<td style="padding-top: 5px">
				<select id="edge-font-size">
					<option value="14">Size</option>
					<option value="18">Large</option>
					<option value="14">Normal</option>
					<option value="10">Small</option>
				</select>
			</td>
		</tr>
	</table>`
	)
	elem('edge-width').value = parseInt(item.width)
	cp.createColorPicker('edge-color')
	elem('edge-color').style.backgroundColor = standardize_color(item.color.color)
	elem('edge-type').value = getDashes(item.dashes, null)
	elem('edge-arrow').value = item.arrows.to.enabled ? item.arrows.to.type : 'none'
	elem('edge-font-size').value = parseInt(item.font.size)
	positionPopUp(point)
	elem('popup-label').focus()
	elem('popup').timer = setTimeout(() => {
		//ensure that the edge cannot be locked out for ever
		cancelEdit(item, callback)
		statusMsg('Edit timed out', 'warn')
	}, TIMETOEDIT)
	lockEdge(item)
}
/**
 * Initialise the dialog for creating nodes/edges
 * @param {string} popUpTitle
 * @param {number} height
 * @param {object} item
 * @param {function} cancelAction
 * @param {function} saveAction
 * @param {function} callback
 */
function initPopUp(popUpTitle, height, item, cancelAction, saveAction, callback) {
	inAddMode = false
	inEditMode = true
	changeCursor('default')
	elem('popup').style.height = height + 'px'
	elem('popup-operation').innerHTML = popUpTitle
	elem('popup-saveButton').onclick = saveAction.bind(this, item, callback)
	elem('popup-cancelButton').onclick = cancelAction.bind(this, item, callback)
	let popupLabel = elem('popup-label')
	popupLabel.style.fontSize = '14px'
	popupLabel.innerText = item.label === undefined ? '' : item.label.replace(/\n/g, ' ')
	let table = elem('popup-table')
	if (table) table.remove()
}

/**
 * Position the editing dialog box so that it is to the left of the item being edited,
 * but not outside the window
 * @param {Object} point
 */
function positionPopUp(point) {
	let popUp = elem('popup')
	popUp.style.display = 'block'
	// popup appears to the left of the given point
	popUp.style.top = `${point.y - popUp.offsetHeight / 2}px`
	let left = point.x - popUp.offsetWidth / 2 - 3
	popUp.style.left = `${left < 0 ? 0 : left}px`
	dragElement(popUp, elem('popup-top'))
}

/**
 * Hide the editing dialog box
 */
function clearPopUp() {
	elem('popup-saveButton').onclick = null
	elem('popup-cancelButton').onclick = null
	elem('popup-label').onkeyup = null
	elem('popup').style.display = 'none'
	if (elem('popup').timer) {
		clearTimeout(elem('popup').timer)
		elem('popup').timer = undefined
	}
	yAwareness.setLocalStateField('addingFactor', 'done')
	inEditMode = false
}
/**
 * User has pressed 'cancel' - abandon adding a node and hide the dialog
 * @param {Function} callback
 */
function cancelAdd(item, callback) {
	clearPopUp()
	callback(null)
	stopEdit()
}
/**
 * User has pressed 'cancel' - abandon the edit and hide the dialog
 * @param {object} item
 * @param {function} [callback]
 */
function cancelEdit(item, callback) {
	clearPopUp()
	item.label = item.oldLabel
	item.font.color = item.oldFontColor
	if (item.from) {
		unlockEdge(item)
	} else {
		unlockNode(item)
	}
	if (callback) callback(null)
	stopEdit()
}
/**
 * called when a node has been added.  Save the label provided
 * @param {Object} node the item that has been added
 * @param {Function} callback
 */
function saveLabel(node, callback) {
	node.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	clearPopUp()
	if (node.label === '') {
		statusMsg('No label: cancelled', 'error')
		callback(null)
		return
	}
	network.manipulation.inMode = 'addNode' // ensure still in Add mode, in case others have done something meanwhile
	callback(node)
	logHistory(`added factor '${node.label}'`)
}
/**
 * save the node format details that have been edited
 * @param {Object} item the node that has been edited
 * @param {Function} callback
 */
function saveNode(item, callback) {
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	clearPopUp()
	if (item.label === '') {
		// if there is no label, cancel (nodes must have a label)
		statusMsg('No label: cancelled', 'error')
		callback(null)
	}
	let color = elem('node-backgroundColor').style.backgroundColor
	item.color.background = color
	item.color.highlight.background = color
	item.color.hover.background = color
	color = elem('node-borderColor').style.backgroundColor
	item.color.border = color
	item.color.highlight.border = color
	item.color.hover.border = color
	item.font.color = elem('node-fontColor').style.backgroundColor
	let borderType = elem('node-borderType').value
	item.borderWidth = borderType == 'none' ? 0 : 4
	item.shapeProperties.borderDashes = convertDashes(borderType)
	network.manipulation.inMode = 'editNode' // ensure still in Add mode, in case others have done something meanwhile
	if (item.label == item.oldLabel) logHistory(`edited factor: '${item.label}'`)
	else logHistory(`edited factor, changing label from '${item.oldLabel}' to '${item.label}'`)
	unlockNode(item)
	callback(item)
}
/**
 * User is about to edit the node.  Make sure that no one else can edit it simultaneously
 * @param {Node} item
 */
function lockNode(item) {
	item.locked = true
	item.opacity = 0.3
	item.oldLabel = item.label
	item.label = item.label + '\n\n' + '[Being edited by ' + myNameRec.name + ']'
	item.wasFixed = Boolean(item.fixed)
	item.fixed = true
	data.nodes.update(item)
}
/**
 * User has finished editing the node.  Unlock it.
 * @param {Node} item
 */
function unlockNode(item) {
	item.locked = false
	item.opacity = 1
	item.fixed = item.wasFixed
	item.oldLabel = undefined
	dontUndo = 'unlocked'
	data.nodes.update(item)
	showNodeOrEdgeData()
}
/**
 * ensure that all factors and links are unlocked (called only when user leaves the page, to clear up for others)
 */
function unlockAll() {
	data.nodes.forEach((node) => {
		if (node.locked) cancelEdit(deepCopy(node))
	})
	data.edges.forEach((edge) => {
		if (edge.locked) cancelEdit(deepCopy(edge))
	})
}
/**
 * save the edge format details that have been edited
 * @param {Object} item the edge that has been edited
 * @param {Function} callback
 */
function saveEdge(item, callback) {
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	clearPopUp()
	if (item.label === '') item.label = ' '
	let color = elem('edge-color').style.backgroundColor
	item.color.color = color
	item.color.hover = color
	item.color.highlight = color
	item.width = parseInt(elem('edge-width').value)
	if (!item.width) item.width = 1
	item.dashes = convertDashes(elem('edge-type').value)
	item.arrows.to = {
		enabled: elem('edge-arrow').value !== 'none',
		type: elem('edge-arrow').value,
	}
	item.font.size = parseInt(elem('edge-font-size').value)
	network.manipulation.inMode = 'editEdge' // ensure still in edit mode, in case others have done something meanwhile
	unlockEdge(item)
	// vis-network silently deselects all edges in the callback (why?).  So we have to mark this edge as unselected in preparation
	clearStatusBar()
	callback(item)
	logHistory(`edited link from '${data.nodes.get(item.from).label}' to '${data.nodes.get(item.to).label}'`)
}
/**
 * Convert from the menu selection to the CSS format of the edge
 * @param {String} val
 */
function convertDashes(val) {
	switch (val) {
		case 'true':
			return true
		case 'false':
			return false
		case 'dashes':
			return [10, 10]
		case 'dots':
			return [2, 8]
		case 'none':
			return false
		default:
			return val
	}
}
function lockEdge(item) {
	item.locked = true
	item.font.color = 'rgba(0,0,0,0.5)'
	item.opacity = 0.1
	item.oldLabel = item.label || ' '
	item.label = 'Being edited by ' + myNameRec.name
	data.edges.update(item)
}
/**
 * User has finished editing the edge.  Unlock it.
 * @param {object} item
 */
function unlockEdge(item) {
	item.locked = false
	item.font.color = 'rgba(0,0,0,1)'
	item.opacity = 1
	item.oldLabel = undefined
	dontUndo = 'unlocked'
	data.edges.update(item)
	showNodeOrEdgeData()
}
/* ----------------- end of node and edge creation and editing dialog -----------------*/

/**
 * if there is already a link from the 'from' node to the 'to' node, return it
 * @param {Object} from A node
 * @param {Object} to Another node
 */
function duplEdge(from, to) {
	return data.edges.get({
		filter: function (item) {
			return item.from == from && item.to == to
		},
	})
}

/**
 * Change the cursor style for the net pane and nav bar
 * @param {object} newCursorStyle
 */
function changeCursor(newCursorStyle) {
	if (inAddMode) return
	netPane.style.cursor = newCursorStyle
	elem('navbar').style.cursor = newCursorStyle
}
/**
 * User has set or changed the map title: update the UI and broadcast the new title
 * @param {event} e
 */
function mapTitle(e) {
	let title = e.target.innerText
	title = setMapTitle(title)
	yNetMap.set('mapTitle', title)
}
function pasteMapTitle(e) {
	e.preventDefault()
	let paste = (e.clipboardData || window.clipboardData).getData('text/plain')
	if (paste instanceof HTMLElement) paste = paste.textContent
	const selection = window.getSelection()
	if (!selection.rangeCount) return false
	selection.deleteFromDocument()
	selection.getRangeAt(0).insertNode(document.createTextNode(paste))
	setMapTitle(elem('maptitle').innerText)
}
/**
 * Format the map title
 * @param {string} title
 */
function setMapTitle(title) {
	let div = elem('maptitle')
	clearStatusBar()
	if (!title) {
		title = 'Untitled map'
	}
	if (title == 'Untitled map') {
		div.classList.add('unsetmaptitle')
		document.title = appName
	} else {
		if (title.length > 50) {
			title = title.slice(0, 50)
			statusMsg('Map title is too long: truncated', 'warn')
		}
		div.classList.remove('unsetmaptitle')
		document.title = `${title}: ${shortAppName} map`
		lastFileName = title.replace(/\s+/g, '').toLowerCase()
	}
	if (title !== div.innerText) div.innerText = title
	if (title.length >= 50) setEndOfContenteditable(div)
	titleDropDown(title)
	return title
}
/**
 * Add this title to the local record of maps used
 * @param {String} title
 */
function titleDropDown(title) {
	let recentMaps = localStorage.getItem('recents')
	if (recentMaps) recentMaps = JSON.parse(recentMaps)
	else recentMaps = {}
	if (title != 'Untitled map') {
		recentMaps[room] = title
		localStorage.setItem('recents', JSON.stringify(recentMaps))
	}
	// if there is more than 1, append a down arrow after the map title as a cue to there being a list
	if (Object.keys(recentMaps).length > 1) elem('recent-rooms-caret').classList.remove('hidden')
}
/**
 * Create a drop down list of previous maps used for user selection
 */
function createTitleDropDown() {
	removeTitleDropDown()
	let selectList = document.createElement('ul')
	selectList.id = 'recent-rooms-select'
	selectList.classList.add('room-titles')
	elem('recent-rooms').appendChild(selectList)
	let recentMaps = JSON.parse(localStorage.getItem('recents'))
	// list is with most recent at the top, and no more than 20 items
	if (recentMaps) {
		let props = Object.keys(recentMaps).reverse().slice(0, 20)
		props.forEach((prop) => {
			makeTitleDropDownEntry(recentMaps[prop], prop)
		})
		makeTitleDropDownEntry('New map', '*new*')
	}

	function makeTitleDropDownEntry(name, room) {
		let li = document.createElement('li')
		li.classList.add('room-title')
		let div = document.createElement('div')
		div.classList.add('room-title-text')
		div.innerText = name
		div.dataset.room = room
		div.addEventListener('click', (event) => changeRoom(event))
		li.appendChild(div)
		selectList.appendChild(li)
	}
}
/**
 * User has clicked one of the previous map titles - confirm and change to the web page for that room
 * @param {Event} event
 */
function changeRoom(event) {
	if (data.nodes.length > 0) if (!confirm('Are you sure you want to move to a different map?')) return
	let newRoom = event.target.dataset.room
	removeTitleDropDown()
	console.log(newRoom)
	let url = new URL(document.location)
	url.search = newRoom != '*new*' ? `?room=${newRoom}` : ''
	window.location.replace(url)
}
/**
 * Remove the drop down list of previous maps if user clicks on the net-pane or on a map title.
 */
function removeTitleDropDown() {
	let oldSelect = elem('recent-rooms-select')
	if (oldSelect) oldSelect.remove()
}
/**
 * unselect all nodes and edges
 */
export function unSelect() {
	hideNotes()
	network.unselectAll()
	clearStatusBar()
}
/* 
  ----------- Calculate statistics in the background -------------
*/
// set  up a web worker to calculate network statistics in parallel with whatever
// the user is doing
var worker = new Worker(new URL('betweenness.js', import.meta.url))
/**
 * Ask the web worker to recalculate network statistics
 */
function recalculateStats() {
	// wait 200 mSecs for things to settle down before recalculating
	setTimeout(() => {
		worker.postMessage([nodes.get(), edges.get()])
	}, 200)
}
worker.onmessage = function (e) {
	if (typeof e.data == 'string') console.log(e.data)
	// don't frighten the horses: statusMsg(e.data, 'error');
	else {
		let nodesToUpdate = []
		data.nodes.get().forEach((n) => {
			if (n.bc != e.data[n.id]) {
				n.bc = e.data[n.id]
				nodesToUpdate.push(n)
			}
		})
		if (nodesToUpdate) {
			data.nodes.update(nodesToUpdate)
		}
	}
}
/* 
  ----------- Status messages ---------------------------------------
*/
/**
 * return a string listing the labels of the given nodes, with nice connecting words
 * @param {Array} factors List of node Ids
 * @param {Boolean} suppressType If true, don't start string with 'Factors'
 */
function listFactors(factors, suppressType) {
	if (factors.length > 5) return factors.length + ' factors'
	let str = ''
	if (!suppressType) {
		str = 'Factor'
		if (factors.length > 1) str = str + 's'
		str = str + ': '
	}
	return str + lf(factors)

	function lf(factors) {
		// recursive fn to return a string of the node labels, separated by commas and 'and'
		let n = factors.length
		let label = "'" + shorten(data.nodes.get(factors[0]).label) + "'"
		if (n == 1) return label
		factors.shift()
		if (n == 2) return label.concat(' and ' + lf(factors))
		return label.concat(', ' + lf(factors))
	}
}

/**
 * return a string listing the number of Links
 * @param {Array} links
 */
function listLinks(links) {
	if (links.length > 1) return links.length + ' links'
	return '1 link'
}
/**
 * returns string of currently selected labels of links and factors, nicely formatted
 * @returns {String} string of labels of links and factors, nicely formatted
 */
function selectedLabels() {
	let selectedNodes = getSelectedAndFixedNodes()
	let selectedEdges = network.getSelectedEdges()
	let msg = ''
	if (selectedNodes.length > 0) msg = listFactors(selectedNodes)
	if (selectedNodes.length > 0 && selectedEdges.length > 0) msg += ' and '
	if (selectedEdges.length > 0) msg += listLinks(selectedEdges)
	return msg
}
/**
 * show the nodes and links selected in the status bar
 */
function showSelected() {
	let msg = selectedLabels()
	if (msg.length > 0) statusMsg(msg + ' selected')
	else clearStatusBar()
}
/* zoom slider */
Network.prototype.zoom = function (scale) {
	let newScale = scale === undefined ? 1 : scale
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 0,
		},
	}
	this.view.moveTo(animationOptions)
}
/**
 * expand/reduce the network view using the value in the zoom slider
 */
function zoomnet() {
	network.zoom(Number(elem('zoom').value))
}
/**
 * zoom by the given amount (+ve or -ve); used by the + and - add the ends of the zoom slider
 * @param {Number} incr
 */
function zoomincr(incr) {
	let newScale = Number(elem('zoom').value)
	newScale += incr
	if (newScale > 4) newScale = 4
	if (newScale <= 0.1) newScale = 0.1
	elem('zoom').value = newScale
	network.zoom(newScale)
}
/**
 * zoom using a pinch/zoom gesture on a tablet
 * note the starting point
 */
var startzoom = 1
function zoomstart() {
	startzoom = Number(elem('zoom').value)
}
/**
 * zoom by the given amount
 * @param {Number} newScale
 */
function zoomset(newScale) {
	let newZoom = startzoom * newScale
	if (newZoom > 4) newZoom = 4
	if (newZoom <= 0.1) newZoom = 0.1
	elem('zoom').value = newZoom
	network.zoom(newZoom)
}

/* var clicks = 0; // accumulate 'mousewheel' clicks sent while display is updating
var ticking = false; // if true, we are waiting for an AnimationFrame */
// see https://www.html5rocks.com/en/tutorials/speed/animations/

/**
 * Zoom using a trackpad (with a mousewheel or two fingers)
 * @param {Event} event
 */
/* function zoomscroll(event) {
	event.preventDefault();
	clicks += event.deltaY;
	requestZoom();
}
function requestZoom() {
	if (!ticking) requestAnimationFrame(zoomUpdate);
	ticking = true;
}
function zoomUpdate() {
	zoomincr(clicks * 0.05);
	ticking = false;
	clicks = 0;
} */

/* -----------Operations related to the top button bar (not the side panel)-------------
 */
/**
 * react to the user pressing the Add node button
 * handles cases when the button is disabled; has previously been pressed; and the Add link
 * button is active, as well as the normal case
 *
 */
function plusNode() {
	switch (inAddMode) {
		case 'disabled':
			return
		case 'addNode':
			removeFactorCursor()
			showPressed('addNode', 'remove')
			stopEdit()
			break
		case 'addLink':
			showPressed('addLink', 'remove')
			stopEdit() // falls through
		default:
			// false
			network.unselectAll()
			changeCursor('cell')
			ghostCursor()
			inAddMode = 'addNode'
			showPressed('addNode', 'add')
			unSelect()
			statusMsg('Click on the map to add a factor')
			network.addNodeMode()
	}
}
/**
 * show a box attached to the cursor to guide where the Factor will be placed when the user clicks.
 */
function ghostCursor() {
	// no ghost cursor if the hardware only supports touch
	if (!window.matchMedia('(any-hover: hover)').matches) return
	const box = document.createElement('div')
	box.classList.add('ghost-factor', 'factor-cursor')
	box.id = 'factor-cursor'
	document.body.appendChild(box)
	const netPaneRect = netPane.getBoundingClientRect()
	keepInWindow(box, netPaneRect)
	document.addEventListener('pointermove', () => {
		keepInWindow(box, netPaneRect)
	})
	function keepInWindow(box, netPaneRect) {
		const boxHalfWidth = box.offsetWidth / 2
		const boxHalfHeight = box.offsetHeight / 2
		let left = window.event.pageX - boxHalfWidth
		box.style.left =
			(left <= netPaneRect.left
				? netPaneRect.left
				: left >= netPaneRect.right - box.offsetWidth
				? netPaneRect.right - box.offsetWidth
				: left) + 'px'
		let top = window.event.pageY - boxHalfHeight
		box.style.top =
			(top <= netPaneRect.top
				? netPaneRect.top
				: top >= netPaneRect.bottom - box.offsetHeight
				? netPaneRect.bottom - box.offsetHeight
				: top) + 'px'
	}
}
/**
 * remove the factor cursor if it exists
 */
function removeFactorCursor() {
	let factorCursor = elem('factor-cursor')
	if (factorCursor) {
		factorCursor.remove()
	}
	clearStatusBar()
}
/**
 * react to the user pressing the Add Link button
 * handles cases when the button is disabled; has previously been pressed; and the Add Node
 * button is active, as well as the normal case
 */
function plusLink() {
	switch (inAddMode) {
		case 'disabled':
			return
		case 'addLink':
			showPressed('addLink', 'remove')
			stopEdit()
			clearStatusBar()
			break
		case 'addNode':
			showPressed('addNode', 'remove')
			stopEdit() // falls through
		default:
			// false
			removeFactorCursor()
			if (data.nodes.length < 2) {
				statusMsg('Two Factors needed to link', 'error')
				break
			}
			changeCursor('crosshair')
			inAddMode = 'addLink'
			showPressed('addLink', 'add')
			unSelect()
			statusMsg('Now drag from the middle of the Source factor to the middle of the Destination factor')
			network.setOptions({
				interaction: {dragView: false, selectable: false},
			})
			network.addEdgeMode()
	}
}
/**
 * cancel adding node and links
 */
function stopEdit() {
	inAddMode = false
	network.disableEditMode()
	clearStatusBar()
	changeCursor('default')
}
/**
 * Add or remove the CSS style showing that the button has been pressed
 * @param {string} el the Id of the button
 * @param {*} action whether to add or remove the style
 *
 */
function showPressed(el, action) {
	elem(el).children.item(0).classList[action]('pressed')
}

function undo() {
	if (buttonIsDisabled('undo')) return
	unSelect()
	yUndoManager.undo()
	logHistory('undid last action')
	undoRedoButtonStatus()
}

function redo() {
	if (buttonIsDisabled('redo')) return
	unSelect()
	yUndoManager.redo()
	logHistory('redid last action')
	undoRedoButtonStatus()
}

function undoRedoButtonStatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0)
	setButtonDisabledStatus('redo', yUndoManager.redoStack.length === 0)
}
/**
 * Returns true if the button is not disabled
 * @param {String} id
 * @returns Boolean
 */
function buttonIsDisabled(id) {
	return elem(id).classList.contains('disabled')
}
/**
 * Change the visible state of a button
 * @param {String} id
 * @param {Boolean} state - true to make the button disabled
 */
function setButtonDisabledStatus(id, state) {
	if (state) elem(id).classList.add('disabled')
	else elem(id).classList.remove('disabled')
}

function deleteNode() {
	network.deleteSelected()
	clearStatusBar()
}
var lastFileName = 'network.json' // the name of the file last read in
let msg = ''
/**
 * Get the name of a map file to read and load it
 * @param {event} e
 */
function readSingleFile(e) {
	var file = e.target.files[0]
	if (!file) {
		return
	}
	let fileName = file.name
	lastFileName = fileName
	document.body.style.cursor = 'wait'
	statusMsg("Reading '" + fileName + "'")
	msg = ''
	e.target.value = ''
	var reader = new FileReader()
	reader.onloadend = function (e) {
		try {
			loadFile(e.target.result)
			if (!msg) statusMsg("Read '" + fileName + "'", 'info')
		} catch (err) {
			statusMsg("Error reading '" + fileName + "': " + err.message, 'error')
			console.log(err)
			return
		}
		document.body.style.cursor = 'default'
	}
	reader.readAsText(file)
}

function openFile() {
	elem('fileInput').click()
}
/**
 * determine what kind of file it is, parse it and replace any current map with the one read from the file
 * @param {string} contents - what is in the file
 */
function loadFile(contents) {
	if (data.nodes.length > 0)
		if (!confirm('Loading a file will delete the current network.  Are you sure you want to replace it?')) return
	// load the file as one single yjs transaction to reduce server traffic
	doc.transact(() => {
		unSelect()
		ensureNotDrawing()
		network.destroy()
		checkMapSaved = true
		nodes.clear()
		edges.clear()
		draw()
	})
	doc.transact(() => {
		switch (lastFileName.split('.').pop().toLowerCase()) {
			case 'csv':
				data = parseCSV(contents)
				break
			case 'graphml':
				data = parseGraphML(contents)
				break
			case 'gml':
				data = parseGML(contents)
				break
			case 'json':
			case 'prsm':
				data = loadJSONfile(contents)
				break
			default:
				throw {message: 'Unrecognised file name suffix'}
		}
		network.setOptions({
			interaction: {
				hideEdgesOnDrag: data.nodes.length > 100,
				hideEdgesOnZoom: data.nodes.length > 100,
			},
		})
		let nodesToUpdate = []
		data.nodes.get().forEach((n) => {
			// ensure that all nodes have a grp property (converting 'group' property for old format files)
			if (!n.grp) n.grp = n.group ? 'group' + (n.group % 9) : 'group0'
			// reassign the sample properties to the nodes
			n = deepMerge(styles.nodes[n.grp], n)
			// version 1.6 made changes to label scaling
			n.scaling = {
				label: {enabled: false, max: 40, min: 10},
				max: 100,
				min: 10,
			}
			nodesToUpdate.push(n)
		})
		data.nodes.update(nodesToUpdate)

		// same for edges
		let edgesToUpdate = []
		data.edges.get().forEach((e) => {
			// ensure that all edges have a grp property (converting 'group' property for old format files)
			if (!e.grp) e.grp = e.group ? 'edge' + (e.group % 9) : 'edge0'
			// reassign the sample properties to the edges
			e = deepMerge(styles.edges[e.grp], e)
			edgesToUpdate.push(e)
		})
		data.edges.update(edgesToUpdate)

		network.fit(0)
		updateLegend()
		logHistory('loaded &lt;' + lastFileName + '&gt;')
	})
	yUndoManager.clear()
	undoRedoButtonStatus()
	toggleDeleteButton()
}
/**
 * Parse and load a PRSM map file, or a JSON file exported from Gephi
 * @param {string} str
 */
function loadJSONfile(str) {
	let json = JSON.parse(str)
	if (json.version && version.substring(0, 3) > json.version.substring(0, 3)) {
		statusMsg('Warning: file was created in an earlier version', 'warn')
		msg = 'old version'
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample
	updateLastSamples(lastNodeSample, lastLinkSample)
	if (json.buttons) setButtonStatus(json.buttons)
	if (json.mapTitle) yNetMap.set('mapTitle', setMapTitle(json.mapTitle))
	if (json.attributeTitles) yNetMap.set('attributeTitles', json.attributeTitles)
	else yNetMap.set('attributeTitles', {})
	if (json.edges.length > 0 && 'source' in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, {
			edges: {
				inheritColors: false,
			},
			nodes: {
				fixed: false,
				parseColor: true,
			},
		})
		nodes.add(parsed.nodes)
		edges.add(parsed.edges)
	} else {
		json.nodes.forEach((n) => {
			// at version 1.5, the title: property was renamed to note:
			if (!n.note && n.title) n.note = n.title.replace(/<br>|<p>/g, '\n')
			delete n.title
		})
		nodes.add(json.nodes)
		json.edges.forEach((e) => {
			if (!e.note && e.title) e.note = e.title.replace(/<br>|<p>/g, '\n')
			delete e.title
		})
		edges.add(json.edges)
	}
	// before v1.4, the style array was called samples
	if (json.samples) json.styles = json.samples
	if (json.styles) {
		styles.nodes = deepMerge(styles.nodes, json.styles.nodes)
		for (let n in styles.nodes) {
			delete styles.nodes[n].chosen
		}
		styles.edges = deepMerge(styles.edges, json.styles.edges)
		for (let e in styles.edges) {
			delete styles.edges[e].chosen
		}
		refreshSampleNodes()
		refreshSampleLinks()
		for (let groupId in styles.nodes) {
			ySamplesMap.set(groupId, {
				node: styles.nodes[groupId],
			})
		}
		for (let edgeId in styles.edges) {
			ySamplesMap.set(edgeId, {
				edge: styles.edges[edgeId],
			})
		}
	}
	yPointsArray.delete(0, yPointsArray.length)
	if (json.underlay) yPointsArray.insert(0, json.underlay)
	yHistory.delete(0, yHistory.length)
	if (json.history) {
		// delete all but the last 10 saved states
		for (let i = 0; i < json.history.length - 10; i++) {
			json.history[i].state = null
		}
		yHistory.insert(0, json.history)
	}
	return {
		nodes: nodes,
		edges: edges,
	}
}
/**
 * parse and load a graphML file
 * @param {string} graphML
 */
function parseGraphML(graphML) {
	let options = {
		attributeNamePrefix: '',
		attrNodeName: 'attr',
		textNodeName: 'txt',
		ignoreAttributes: false,
		ignoreNameSpace: true,
		allowBooleanAttributes: false,
		parseNodeValue: true,
		parseAttributeValue: true,
		trimValues: true,
		parseTrueNumberOnly: false,
		arrayMode: false, //"strict"
	}
	var result = parser.validate(graphML, options)
	if (result !== true) {
		throw {
			message: result.err.msg + '(line ' + result.err.line + ')',
		}
	}
	let jsonObj = parser.parse(graphML, options)
	nodes.add(
		jsonObj.graphml.graph.node.map((n) => {
			return {
				id: n.attr.id.toString(),
				label: getLabel(n.data),
			}
		})
	)
	edges.add(
		jsonObj.graphml.graph.edge.map((e) => {
			return {
				id: e.attr.id.toString(),
				from: e.attr.source.toString(),
				to: e.attr.target.toString(),
			}
		})
	)
	return {
		nodes: nodes,
		edges: edges,
	}

	function getLabel(arr) {
		for (let at of arr) {
			if (at.attr.key == 'label') return at.txt
		}
	}
}
/**
 * Parse and load a GML file
 * @param {string} gml
 */
function parseGML(gml) {
	if (gml.search('graph') < 0) throw {message: 'invalid GML format'}
	let tokens = gml.match(/"[^"]+"|[\w]+|\[|\]/g)
	let node
	let edge
	let edgeId = 0
	let tok = tokens.shift()
	while (tok) {
		switch (tok) {
			case 'graph':
				break
			case 'node':
				tokens.shift() // [
				node = {}
				tok = tokens.shift()
				while (tok != ']') {
					switch (tok) {
						case 'id':
							node.id = tokens.shift().toString()
							break
						case 'label':
							node.label = splitText(tokens.shift().replace(/"/g, ''), NODEWIDTH)
							break
						case 'color':
						case 'colour':
							node.color = {}
							node.color.background = tokens.shift().replace(/"/g, '')
							break
						case '[': // skip embedded groups
							while (tok != ']') tok = tokens.shift()
							break
						default:
							break
					}
					tok = tokens.shift() // ]
				}
				if (node.label == undefined) node.label = node.id
				nodes.add(node)
				break
			case 'edge':
				tokens.shift() // [
				edge = {}
				tok = tokens.shift()
				while (tok != ']') {
					switch (tok) {
						case 'id':
							edge.id = tokens.shift().toString()
							break
						case 'source':
							edge.from = tokens.shift().toString()
							break
						case 'target':
							edge.to = tokens.shift().toString()
							break
						case 'label':
							edge.label = tokens.shift().replace(/"/g, '')
							break
						case 'color':
						case 'colour':
							edge.color = tokens.shift().replace(/"/g, '')
							break
						case '[': // skip embedded groups
							while (tok != ']') tok = tokens.shift()
							break
						default:
							break
					}
					tok = tokens.shift() // ]
				}
				if (edge.id == undefined) edge.id = (edgeId++).toString()
				edges.add(edge)
				break
			default:
				break
		}
		tok = tokens.shift()
	}
	return {
		nodes: nodes,
		edges: edges,
	}
}
/**
 * Read a comma separated values file consisting of 'From' label and 'to' label, on each row,
     with a header row (ignored) 
	optional, cols 3 and 4 can include the groups (styles) of the from and to nodes,
	column 5 can include the style of the edge.  All these must be integers between 1 and 9
 * @param {string} csv 
 */
function parseCSV(csv) {
	let lines = csv.split('\n')
	let labels = new Map()
	let links = []
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].length <= 2) continue // empty line
		let line = lines[i].split(',')
		let from = node(line[0], line[2])
		let to = node(line[1], line[3])
		let grp = line[4]
		if (grp) grp = 'edge' + (parseInt(grp.trim()) - 1)
		links.push({
			id: i.toString(),
			from: from,
			to: to,
			grp: grp,
		})
	}
	nodes.add(Array.from(labels.values()))
	edges.add(links)
	return {
		nodes: nodes,
		edges: edges,
	}

	function node(label, grp) {
		label = label.trim()
		if (grp) grp = 'group' + (grp.trim() - 1)
		if (labels.get(label) == undefined) {
			labels.set(label, {id: label.toString(), label: label, grp: grp})
		}
		return labels.get(label).id
	}
}
/**
 * ensure that the styles displayed in the node styles panel display the styles defined in the styles array
 */
function refreshSampleNodes() {
	let sampleElements = Array.from(document.getElementsByClassName('sampleNode'))
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i]
		let node = sampleElement.dataSet.get()[0]
		node = deepMerge(node, styles.nodes['group' + i])
		node.label = node.groupLabel
		sampleElement.dataSet.remove(node.id)
		sampleElement.dataSet.update(node)
		sampleElement.net.fit()
	}
}
/**
 * ensure that the styles displayed in the link styles panel display the styles defined in the styles array
 */
function refreshSampleLinks() {
	let sampleElements = Array.from(document.getElementsByClassName('sampleLink'))
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i]
		let edge = sampleElement.dataSet.get()[0]
		edge = deepMerge(edge, styles.edges['edge' + i])
		edge.label = edge.groupLabel
		sampleElement.dataSet.remove(edge.id)
		sampleElement.dataSet.update(edge)
		sampleElement.net.fit()
	}
}

/**
 * save the current map as a PRSM file (in JSON format)
 */
function savePRSMfile() {
	network.storePositions()
	let json = JSON.stringify(
		{
			saved: new Date(Date.now()).toLocaleString(),
			version: version,
			room: room,
			mapTitle: elem('maptitle').innerText,
			lastNodeSample: lastNodeSample,
			lastLinkSample: lastLinkSample,
			// clustering, and up/down, paths between and x links away settings are not saved (and hidden property is not saved)
			buttons: getButtonStatus(),
			attributeTitles: yNetMap.get('attributeTitles'),
			styles: styles,
			nodes: data.nodes.get({
				fields: [
					'id',
					'label',
					'note',
					'grp',
					'x',
					'y',
					'arrows',
					'color',
					'font',
					'borderWidth',
					'shapeProperties',
					'created',
					'modified',
				],
				filter: (n) => !n.isCluster,
			}),
			edges: data.edges.get({
				fields: ['id', 'label', 'note', 'grp', 'from', 'to', 'color', 'width', 'dashes', 'created', 'modified'],
				filter: (e) => !e.isClusterEdge,
			}),
			underlay: yPointsArray.toArray(),
			history: yHistory.toArray(),
		},
		null,
		'\t'
	)
	saveStr(json, 'prsm')
}
/**
 * Save the string to a local file
 * @param {string} str file contents
 * @param {string} extn file extension
 *
 * Browser will only ask for name and location of the file to be saved if
 * it has a user setting to do so.  Otherwise, it is saved at a default
 * download location with a default name.
 */
function saveStr(str, extn) {
	setFileName(extn)
	const a = document.createElement('a')
	const file = new Blob([str], {type: 'text/plain'})
	a.href = URL.createObjectURL(file)
	a.download = lastFileName
	a.click()
	URL.revokeObjectURL(a.href)
	checkMapSaved = false
	dirty = false
}
/**
 * save the map as a PNG image file
 */

const upscaling = 4 // how much bigger the image is than the displayed map

function exportPNGfile() {
	setFileName('png')
	const a = document.createElement('a')
	document.body.appendChild(a)
	a.setAttribute('style', 'display: none')
	// create a very large canvas, so we can download at high resolution
	let bigNetPane = null
	let bigNetwork = null
	let bigNetCanvas = null
	network.storePositions()
	bigNetPane = document.createElement('div')
	bigNetPane.id = 'big-net-pane'
	bigNetPane.style.position = 'absolute'
	bigNetPane.style.top = '-9999px'
	bigNetPane.style.left = '-9999px'
	bigNetPane.style.width = `${netPane.offsetWidth * upscaling}px`
	bigNetPane.style.height = `${netPane.offsetHeight * upscaling}px`
	elem('main').appendChild(bigNetPane)
	bigNetwork = new Network(bigNetPane, data, {
		physics: {enabled: false},
		edges: {
			smooth: {
				enabled: elem('curveSelect').value === 'Curved',
				type: 'straightCross',
			},
		},
	})
	bigNetCanvas = bigNetPane.firstElementChild.firstElementChild
	bigNetwork.moveTo({
		position: network.getViewPosition(),
		scale: network.getScale() * upscaling,
	})
	bigNetwork.once('afterDrawing', () => {
		a.href = setCanvasBackgroundColor(bigNetCanvas).toDataURL('image/png')
		a.download = lastFileName
		a.addEventListener('click', () => {
			a.remove()
			bigNetwork.destroy()
			bigNetPane.remove()
			statusMsg(`'${lastFileName}' saved`, 'info')
		})
		a.click()
	})
}
function setCanvasBackgroundColor(canvas, color = '#ffffff') {
	let context = canvas.getContext('2d')
	context.setTransform()
	context.globalCompositeOperation = 'destination-over'
	context.fillStyle = color
	context.fillRect(0, 0, canvas.width, canvas.height)
	return canvas
}

/**
 * resets lastFileName to have supplied extension
 * @param {string} extn filename extension to apply
 */
function setFileName(extn) {
	let pos = lastFileName.indexOf('.')
	lastFileName = lastFileName.substr(0, pos < 0 ? lastFileName.length : pos) + '.' + extn
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels and style ids are saved
 */
function exportCVS() {
	let dummyDiv = document.createElement('div')
	dummyDiv.id = 'dummy-div'
	dummyDiv.style.display = 'none'
	container.appendChild(dummyDiv)
	let qed = new Quill('#dummy-div')
	let str = 'Id,Label,Style,Note\n'
	for (let node of data.nodes.get()) {
		str += node.id + ','
		if (node.label) str += '"' + node.label.replaceAll('\n', ' ') + '"'
		str += ',' + node.grp + ','
		if (node.note) {
			qed.setContents(node.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {inlineStyles: true})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'nodes.csv')
	str = 'Source,Target,Type,Id,Label,Style,Note\n'
	for (let edge of data.edges.get()) {
		str += edge.from + ','
		str += edge.to + ','
		str += 'directed,'
		str += edge.id + ','
		if (edge.label) str += edge.label.replaceAll('\n', ' ') + '"'
		str += ',' + edge.grp + ','
		if (edge.note) {
			qed.setContents(edge.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {inlineStyles: true})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'edges.csv')
	dummyDiv.remove()
}
/**
 * Save the map as a GML file
 */
function exportGML() {
	let str =
		'Creator "prsm ' + version + ' on ' + new Date(Date.now()).toLocaleString() + '"\ngraph\n[\n\tdirected 1\n'
	let nodeIds = data.nodes.map((n) => n.id) //use integers, not GUIDs for node ids
	for (let node of data.nodes.get()) {
		str += '\tnode\n\t[\n\t\tid ' + nodeIds.indexOf(node.id)
		if (node.label) str += '\n\t\tlabel "' + node.label + '"'
		let color = node.color.background || styles.nodes.group0.color.background
		str += '\n\t\tcolor "' + color + '"'
		str += '\n\t]\n'
	}
	for (let edge of data.edges.get()) {
		str += '\tedge\n\t[\n\t\tsource ' + nodeIds.indexOf(edge.from)
		str += '\n\t\ttarget ' + nodeIds.indexOf(edge.to)
		if (edge.label) str += '\n\t\tlabel "' + edge.label + '"'
		let color = edge.color.color || styles.edges.edge0.color.color
		str += '\n\t\tcolor "' + color + '"'
		str += '\n\t]\n'
	}
	str += '\n]'
	saveStr(str, 'gml')
}
/**
 * set up the modal dialog that opens when the user clicks the Share icon in the nav bar
 */
function setUpShareDialog() {
	let modal = elem('shareModal')
	let inputElem = elem('text-to-copy')
	let copiedText = elem('copied-text')

	// When the user clicks the button, open the modal
	listen('share', 'click', () => {
		let path = window.location.pathname + '?room=' + room
		let linkToShare = window.location.origin + path
		modal.style.display = 'block'
		inputElem.cols = linkToShare.length.toString()
		inputElem.value = linkToShare
		inputElem.style.height = inputElem.scrollHeight - 3 + 'px'
		inputElem.select()
		network.storePositions()
	})
	listen('clone-button', 'click', () => openWindow('clone'))
	listen('view-button', 'click', () => openWindow('view'))
	listen('table-button', 'click', () => openWindow('table'))

	function openWindow(type) {
		let path = ''
		switch (type) {
			case 'clone':
				path = window.location.pathname + '?room=' + clone()
				break
			case 'view':
				path = window.location.pathname + '?room=' + room + '&viewing'
				break
			case 'table':
				path = window.location.pathname.replace('prsm.html', 'table.html') + '?room=' + room
				break
			default:
				console.log('Bad case in openWindow()')
				break
		}
		window.open(path, '_blank')
	}
	// When the user clicks on <span> (x), close the modal
	listen('modal-close', 'click', closeShareDialog)
	// When the user clicks anywhere on the background, close it
	listen('shareModal', 'click', closeShareDialog)

	function closeShareDialog() {
		let modal = elem('shareModal')
		if (event.target == modal || event.target == elem('modal-close')) {
			modal.style.display = 'none'
			copiedText.style.display = 'none'
		}
	}
	listen('copy-text', 'click', (e) => {
		e.preventDefault()
		// Select the text
		inputElem.select()
		if (copyText(inputElem.value))
			// Display the copied text message
			copiedText.style.display = 'inline-block'
	})
}

/**
 * clone the map, i.e copy everything into a new room
 * @return {string} name of new room
 */
function clone() {
	let clonedRoom = generateRoom()
	let clonedDoc = new Y.Doc()
	let ws = new WebsocketProvider(websocket, 'prsm' + clonedRoom, clonedDoc)
	ws.awareness.destroy()
	ws.on('sync', () => {
		let state = Y.encodeStateAsUpdate(doc)
		Y.applyUpdate(clonedDoc, state)
	})
	return clonedRoom
}

/* ----------------------------------------------------------- Search ------------------------------------------------------*/
/**
 * Open an input for user to type label of node to search for and generate suggestions when user starts typing
 */
function search() {
	let searchBar = elem('search-bar')
	if (searchBar.style.display == 'block') hideSearchBar()
	else {
		searchBar.style.display = 'block'
		elem('search-icon').style.display = 'block'
		searchBar.focus()
		listen('search-bar', 'keyup', searchTargets)
	}
}
/**
 * generate and display a set of suggestions - nodes with labels that include the substring that the user has typed
 */
function searchTargets() {
	let str = elem('search-bar').value
	if (!str || str == ' ') {
		if (elem('targets')) elem('targets').remove()
		return
	}
	let targets = elem('targets')
	if (targets) targets.remove()
	targets = document.createElement('ul')
	targets.id = 'targets'
	targets.classList.add('search-ul')
	str = str.toLowerCase()
	let suggestions = window.data.nodes.get().filter((n) => n.label.toLowerCase().includes(str))
	suggestions.slice(0, 8).forEach((n) => {
		let li = document.createElement('li')
		li.classList.add('search-suggestion')
		let div = document.createElement('div')
		div.classList.add('search-suggestion-text')
		div.innerText = n.label.replace(/\n/g, ' ')
		div.dataset.id = n.id
		div.addEventListener('click', (event) => doSearch(event))
		li.appendChild(div)
		targets.appendChild(li)
	})
	if (suggestions.length > 8) {
		let li = document.createElement('li')
		li.classList.add('search-suggestion')
		let div = document.createElement('div')
		div.className = 'search-suggestion-text and-more'
		div.innerText = 'and more ...'
		li.appendChild(div)
		targets.appendChild(li)
	}
	elem('suggestion-list').appendChild(targets)
}
/**
 * do the search using the string in the search bar and, when found, focus on that node
 */
function doSearch(event) {
	let nodeId = event.target.dataset.id
	if (nodeId) {
		window.network.focus(nodeId, {scale: 2, animation: true})
		elem('zoom').value = 2
		hideSearchBar()
	}
}
function hideSearchBar() {
	let searchBar = elem('search-bar')
	if (elem('targets')) elem('targets').remove()
	searchBar.value = ''
	searchBar.style.display = 'none'
	elem('search-icon').style.display = 'none'
}

/**
 * display help page in a separate window
 */
function displayHelp() {
	window.open('./help.html#contents', 'helpWindow')
}

/**
 * show or hide the side panel
 */
function togglePanel() {
	if (container.panelHidden) {
		panel.classList.remove('hide')
		positionNotes()
	} else {
		panel.classList.add('hide')
	}
	container.panelHidden = !container.panelHidden
}
dragElement(elem('panel'), elem('panelHeader'))

/* ------------------------------------------------operations related to the side panel -------------------------------------*/

/**
 * when the window is resized, make sure that the pane is still visible
 * @param {HTMLelement} pane
 */
function keepPaneInWindow(pane) {
	if (pane.offsetLeft + pane.offsetWidth > container.offsetLeft + container.offsetWidth) {
		pane.style.left = container.offsetLeft + container.offsetWidth - pane.offsetWidth + 'px'
	}
	if (pane.offsetTop + pane.offsetHeight > container.offsetTop + container.offsetHeight) {
		pane.style.top =
			container.offsetTop +
			container.offsetHeight -
			pane.offsetHeight -
			document.querySelector('footer').offsetHeight +
			'px'
	}
}

function openTab(tabId) {
	let i, tabcontent, tablinks
	// Get all elements with class="tabcontent" and hide them by moving them off screen
	tabcontent = document.getElementsByClassName('tabcontent')
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].classList.add('hide')
	}
	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName('tablinks')
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(' active', '')
	}
	// Show the current tab, and add an "active" class to the button that opened the tab
	elem(tabId).classList.remove('hide')
	event.currentTarget.className += ' active'
	// if a Notes panel is in the way, move it
	positionNotes()
}

/**
 * return an object with the current Network panel setting for saving
 * settings for link radius and up/down stream are not saved
 * @return an object with the Network panel settings
 */
function getButtonStatus() {
	return {
		snapToGrid: elem('snaptogridswitch').checked,
		curve: elem('curveSelect').value,
		background: elem('netBackColorWell').value,
		legend: elem('showLegendSwitch').checked,
		sizing: elem('sizing').value,
	}
}
/**
 * Set the Network panel buttons to their values loaded from a file
 * @param {Object} settings
 */
function setButtonStatus(settings) {
	yNetMap.set('snapToGrid', settings.snapToGrid)
	yNetMap.set('curve', settings.curve)
	yNetMap.set('background', settings.background || '#ffffff')
	yNetMap.set('legend', settings.legend)
	yNetMap.set('sizing', settings.sizing)
	yNetMap.set('radius', {radiusSetting: 'All', selected: []})
	yNetMap.set('stream', {streamSetting: 'All', selected: []})
	yNetMap.set('paths', {pathsSetting: 'All', selected: []})
	yNetMap.set('cluster', 'All')
}
// Factors and Links Tabs
function applySampleToNode(event) {
	if (event.detail != 1) return // only process single clicks here
	let selectedNodeIds = network.getSelectedNodes()
	if (selectedNodeIds.length == 0) return
	let nodesToUpdate = []
	let sample = event.currentTarget.groupNode
	for (let node of data.nodes.get(selectedNodeIds)) {
		node = deepMerge(node, styles.nodes[sample])
		node.grp = sample
		nodesToUpdate.push(node)
	}
	data.nodes.update(nodesToUpdate)
	lastNodeSample = sample
}

function applySampleToLink(event) {
	if (event.detail != 1) return // only process single clicks here
	let sample = event.currentTarget.groupLink
	let selectedEdges = network.getSelectedEdges()
	if (selectedEdges.length == 0) return
	let edgesToUpdate = []
	for (let edge of data.edges.get(selectedEdges)) {
		edge = deepMerge(edge, styles.edges[sample])
		edge.grp = sample
		edgesToUpdate.push(edge)
	}
	data.edges.update(edgesToUpdate)
	lastLinkSample = sample
}
/**
 * Remember the last style sample that the user clicked and use this for future factors/links
 * Mark the sample with a light blue border
 * @param {number} nodeId
 * @param {number} linkId
 */
export function updateLastSamples(nodeId, linkId) {
	if (nodeId) {
		lastNodeSample = nodeId
		let sampleNodes = Array.from(document.getElementsByClassName('sampleNode'))
		let node = sampleNodes.filter((e) => e.groupNode === nodeId)[0]
		sampleNodes.forEach((n) => n.classList.remove('sampleSelected'))
		node.classList.add('sampleSelected')
	}
	if (linkId) {
		lastLinkSample = linkId
		let sampleLinks = Array.from(document.getElementsByClassName('sampleLink'))
		let link = sampleLinks.filter((e) => e.groupLink === linkId)[0]
		sampleLinks.forEach((n) => n.classList.remove('sampleSelected'))
		link.classList.add('sampleSelected')
	}
}

/**
 * Hide or reveal all the Factors with the given style
 * @param {Object} obj {sample: state}
 */
function updateFactorsHiddenByStyle(obj) {
	for (const sampleElementId in obj) {
		let sampleElement = elem(sampleElementId)
		let state = obj[sampleElementId]
		sampleElement.dataset.hide = state ? 'hidden' : 'visible'
		sampleElement.style.opacity = state ? 0.6 : 1.0
	}
}

/********************************************************Notes********************************************** */
/**
 * Globally either display or don't display notes when a factor or link is selected
 * @param {Event} e
 */
function showNotesSwitch(e) {
	showNotesToggle = e.target.checked
	doShowNotes(showNotesToggle)
	yNetMap.set('showNotes', showNotesToggle)
}
function doShowNotes(toggle) {
	elem('showNotesSwitch').checked = toggle
	showNotesToggle = toggle
	network.redraw()
	showNodeOrEdgeData()
}
/**
 * User has clicked the padlock.  Toggle padlock state and fix the location of the node
 */
function setFixed() {
	let locked = elem('fixed').style.display == 'none'
	let node = data.nodes.get(editor.id)
	node.fixed = locked
	node.shadow = locked
	elem('fixed').style.display = node.fixed ? 'inline' : 'none'
	elem('unfixed').style.display = node.fixed ? 'none' : 'inline'
	data.nodes.update(node)
}
/**
 * Display a panel to show info about the selected edge or node
 */
function showNodeOrEdgeData() {
	hideNotes()
	if (!showNotesToggle) return
	if (network.getSelectedNodes().length == 1) showNodeData()
	else if (network.getSelectedEdges().length == 1) showEdgeData()
}
/**
 * Hide the Node or Edge Data panel
 */
function hideNotes() {
	if (editor == null) return
	elem('nodeDataPanel').classList.add('hide')
	elem('edgeDataPanel').classList.add('hide')
	document.getSelection().removeAllRanges()
	document.querySelectorAll('.ql-toolbar').forEach((e) => e.remove())
	editor = null
}
/**
 * Show the notes box, the fixed node check box and the node statistics
 */
function showNodeData(nodeId) {
	let panel = elem('nodeDataPanel')
	nodeId = nodeId || network.getSelectedNodes()[0]
	let node = data.nodes.get(nodeId)
	elem('fixed').style.display = node.fixed ? 'inline' : 'none'
	elem('unfixed').style.display = node.fixed ? 'none' : 'inline'
	elem('nodeLabel').innerHTML = node.label ? shorten(node.label) : ''
	if (node.created) {
		elem('nodeCreated').innerHTML = `${timeAndDate(node.created.time)} by ${node.created.user}`
		elem('nodeCreation').style.display = 'flex'
	} else elem('nodeCreation').style.display = 'none'
	if (node.modified) {
		elem('nodeModified').innerHTML = `${timeAndDate(node.modified.time)} by ${node.modified.user}`
		elem('nodeModification').style.display = 'flex'
	} else elem('nodeModification').style.display = 'none'
	elem('node-notes').className = 'notes'
	editor = new Quill('#node-notes', {
		modules: {
			toolbar: [
				'bold',
				'italic',
				'underline',
				'link',
				{list: 'ordered'},
				{list: 'bullet'},
				{indent: '-1'},
				{indent: '+1'},
			],
		},
		placeholder: 'Notes',
		theme: 'snow',
		readOnly: viewOnly,
		bounds: elem('edit-container'),
	})
	editor.id = node.id
	if (node.note) {
		if (node.note instanceof Object) editor.setContents(node.note)
		else editor.setText(node.note)
	} else editor.setText('')
	editor.on('text-change', (delta, oldDelta, source) => {
		if (source == 'user')
			data.nodes.update({
				id: nodeId,
				note: isQuillEmpty(editor) ? '' : editor.getContents(),
				modified: timestamp(),
			})
	})
	panel.classList.remove('hide')
	displayStatistics(nodeId)
	positionNotes()
}

function isQuillEmpty(quill) {
	if ((quill.getContents()['ops'] || []).length !== 1) {
		return false
	}
	return quill.getText().trim().length === 0
}

function showEdgeData() {
	let panel = elem('edgeDataPanel')
	let edgeId = network.getSelectedEdges()[0]
	let edge = data.edges.get(edgeId)
	elem('edgeLabel').innerHTML = edge.label && edge.label.trim() ? shorten(edge.label) : 'Link'
	if (edge.created) {
		elem('edgeCreated').innerHTML = `${timeAndDate(edge.created.time)} by ${edge.created.user}`
		elem('edgeCreation').style.display = 'flex'
	} else elem('edgeCreation').style.display = 'none'
	if (edge.modified) {
		elem('edgeModified').innerHTML = `${timeAndDate(edge.modified.time)} by ${edge.modified.user}`
		elem('edgeModification').style.display = 'flex'
	} else elem('edgeModification').style.display = 'none'
	editor = new Quill('#edge-notes', {
		modules: {
			toolbar: [
				'bold',
				'italic',
				'underline',
				'link',
				{list: 'ordered'},
				{list: 'bullet'},
				{indent: '-1'},
				{indent: '+1'},
			],
		},
		placeholder: 'Notes',
		theme: 'snow',
		readOnly: viewOnly,
		bounds: elem('edit-container'),
	})
	editor.id = edge.id
	if (edge.note) {
		if (edge.note instanceof Object) editor.setContents(edge.note)
		else editor.setText(edge.note)
	} else editor.setText('')
	editor.on('text-change', (delta, oldDelta, source) => {
		if (source == 'user')
			data.edges.update({
				id: edgeId,
				note: isQuillEmpty(editor) ? '' : editor.getContents(),
				modified: timestamp(),
			})
	})
	panel.classList.remove('hide')
	positionNotes()
}

// Statistics specific to a node
function displayStatistics(nodeId) {
	// leverage (outDegree / inDegree)
	let inDegree = network.getConnectedNodes(nodeId, 'from').length
	let outDegree = network.getConnectedNodes(nodeId, 'to').length
	let leverage = inDegree == 0 ? '--' : (outDegree / inDegree).toPrecision(3)
	elem('leverage').textContent = leverage
	let node = data.nodes.get(nodeId)
	elem('bc').textContent = node.bc >= 0 ? parseFloat(node.bc).toPrecision(3) : '--'
}

/**
 * ensure that the panel is not outside the net pane, nor obscuring the Settings panel
 * @param {HTMLElement} panel
 */
function positionNotes() {
	let notesPanel
	if (!elem('nodeDataPanel').classList.contains('hide')) notesPanel = elem('nodeDataPanel')
	if (!elem('edgeDataPanel').classList.contains('hide')) notesPanel = elem('edgeDataPanel')
	if (!notesPanel) return
	let notesPanelRect = notesPanel.getBoundingClientRect()
	let settingsRect = elem('panel').getBoundingClientRect()
	let netPaneRect = netPane.getBoundingClientRect()
	if (notesPanelRect.right > settingsRect.left && notesPanelRect.top < settingsRect.bottom) {
		notesPanel.style.left = settingsRect.left - notesPanelRect.width - 20 + 'px'
	}
	if (notesPanelRect.left < netPaneRect.left) notesPanel.style.left = netPaneRect.left + 20 + 'px'
	if (notesPanelRect.right > netPaneRect.right)
		notesPanel.style.left = netPaneRect.right - notesPanelRect.width - 20 + 'px'
	if (notesPanelRect.top < netPaneRect.top) notesPanel.style.top = netPaneRect.top + 20 + 'px'
	if (notesPanelRect.bottom > netPaneRect.bottom)
		notesPanel.style.top = Math.max(netPaneRect.bottom - notesPanelRect.height, netPaneRect.top) + 20 + 'px'
}
// Network tab

/**
 * Choose and apply a layout algorithm
 */
function autoLayout(e) {
	let option = e.target.value
	let selectElement = elem('layoutSelect')
	selectElement.value = option
	network.storePositions() // record current positions so it can be undone
	doc.transact(() => {
		switch (option) {
			case 'off': {
				network.setOptions({physics: {enabled: false}})
				break
			}
			case 'trophic': {
				try {
					trophic(data)
					trophicDistribute()
					data.nodes.update(data.nodes.get())
					elem('layoutSelect').value = 'off'
				} catch (e) {
					statusMsg(`Trophic layout: ${e.message}`, 'error')
				}
				break
			}
			case 'fan':
				{
					let nodes = data.nodes.get().filter((n) => !n.hidden)
					nodes.forEach((n) => (n.level = undefined))
					let selectedNodes = getSelectedAndFixedNodes().map((nId) => data.nodes.get(nId))
					if (selectedNodes.length == 0) {
						statusMsg('At least one Factor needs to be selected', 'error')
						elem('layoutSelect').value = 'off'
						return
					}
					// if Up or Down stream are selected, use those for the direction
					let direction = 'from'
					if (getRadioVal('stream') == 'downstream') direction = 'to'
					else if (getRadioVal('stream') == 'upstream') direction = 'from'
					else {
						// if neither,
						//  and more links from the selected nodes are going upstream then downstream,
						//  put the selected nodes on the right, else on the left
						let nUp = 0
						let nDown = 0
						selectedNodes.forEach((sl) => {
							nUp += network
								.getConnectedNodes(sl.id, 'to')
								.filter((nId) => !data.nodes.get(nId).hidden).length
							nDown += network
								.getConnectedNodes(sl.id, 'from')
								.filter((nId) => !data.nodes.get(nId).hidden).length
						})
						direction = nUp > nDown ? 'to' : 'from'
					}
					let minX = Math.min(...nodes.map((n) => n.x))
					let maxX = Math.max(...nodes.map((n) => n.x))
					selectedNodes.forEach((n) => {
						setZLevel(n, direction)
					})
					nodes.forEach((n) => {
						if (n.level == undefined) n.level = 0
					})
					let maxLevel = Math.max(...nodes.map((n) => n.level))
					let gap = (maxX - minX) / maxLevel
					for (let l = 0; l <= maxLevel; l++) {
						let x = l * gap + minX
						if (direction == 'from') x = maxX - l * gap
						let nodesOnLevel = nodes.filter((n) => n.level == l)
						nodesOnLevel.forEach((n) => (n.x = x))
						let ySpaceNeeded = nodesOnLevel
							.map((n) => {
								let box = network.getBoundingBox(n.id)
								return box.bottom - box.top + 10
							})
							.reduce((a, b) => a + b, 0)
						let yGap = ySpaceNeeded / nodesOnLevel.length
						let newY = -ySpaceNeeded / 2
						nodesOnLevel
							.sort((a, b) => a.y - b.y)
							.forEach((n) => {
								n.y = newY
								newY += yGap
							})
					}
					data.nodes.update(nodes)
					elem('layoutSelect').value = 'off'
				}
				break
			default: {
				let options = {physics: {solver: option, stabilization: true}}
				options.physics[option] = {}
				options.physics[option].springLength = avEdgeLength()
				network.setOptions(options)
				// cancel the iterative algorithms as soon as they have stabilized
				network.on('stabilized', () => {
					network.setOptions({physics: {enabled: false}})
					network.storePositions()
					elem('layoutSelect').value = 'off'
					data.nodes.update(data.nodes.get())
				})
				break
			}
		}
	})

	logHistory(`applied ${selectElement.options[selectElement.selectedIndex].innerHTML} layout`)

	/**
	 * set the levels for fan, using a breadth first search
	 * @param {object} node root node
	 * @param {string} direction either 'from' or 'to', depending on whether the links to use are point from or to the node
	 */
	function setZLevel(node, direction) {
		let q = [node]
		let level = 0
		node.level = 0
		while (q.length > 0) {
			let currentNode = q.shift()
			let connectedNodes = data.nodes
				.get(network.getConnectedNodes(currentNode.id, direction))
				.filter((n) => !n.hidden && n.level == undefined)
			if (connectedNodes.length > 0) {
				level = currentNode.level + 1
				connectedNodes.forEach((n) => {
					n.level = level
					console.table([currentNode.label, direction, level, n.label])
				})
				q = q.concat(connectedNodes)
			}
		}
	}
	/**
	 * find the average length of all edges, as a guide to the layout spring length
	 * so that map is roughly as spaced out as before layout
	 * @returns average length (in canvas units)
	 */
	function avEdgeLength() {
		let edgeSum = 0
		data.edges.forEach((e) => {
			let from = data.nodes.get(e.from)
			let to = data.nodes.get(e.to)
			edgeSum += Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2)
		})
		return edgeSum / data.edges.length
	}
	/**
	 * At each level for a trophic layout, distribute the Factors equally along the vertical axis,
	 * avoiding overlaps
	 */
	function trophicDistribute() {
		for (let level = 0; level <= NLEVELS; level++) {
			let nodesOnLevel = data.nodes.get().filter((n) => n.level == level)
			let ySpaceNeeded = nodesOnLevel
				.map((n) => {
					let box = network.getBoundingBox(n.id)
					return box.bottom - box.top + 10
				})
				.reduce((a, b) => a + b, 0)
			let gap = ySpaceNeeded / nodesOnLevel.length
			let newY = -ySpaceNeeded / 2
			nodesOnLevel
				.sort((a, b) => a.y - b.y)
				.forEach((n) => {
					n.y = newY
					newY += gap
				})
		}
	}
}

function snapToGridSwitch(e) {
	snapToGridToggle = e.target.checked
	doSnapToGrid(snapToGridToggle)
	yNetMap.set('snapToGrid', snapToGridToggle)
}

function doSnapToGrid(toggle) {
	elem('snaptogridswitch').checked = toggle
	if (toggle) {
		data.nodes.update(
			data.nodes.get().map((n) => {
				snapToGrid(n)
				return n
			})
		)
	}
}

function selectCurve(e) {
	let option = e.target.value
	setCurve(option)
	yNetMap.set('curve', option)
}

function setCurve(option) {
	elem('curveSelect').value = option
	network.setOptions({
		edges: {
			smooth: option === 'Curved',
		},
	})
}

function updateNetBack(color) {
	let ul = elem('underlay')
	ul.style.backgroundColor = color
	// if in drawing mode, make the underlay translucent so that network shows through
	if (elem('toolbox').style.display == 'block') makeTranslucent(ul)
	yNetMap.set('background', color)
}

function makeTranslucent(el) {
	el.style.backgroundColor = getComputedStyle(el).backgroundColor.replace(')', ', 0.2)').replace('rgb', 'rgba')
}

function makeSolid(el) {
	el.style.backgroundColor = getComputedStyle(el).backgroundColor.replace(', 0.2)', ')').replace('rgba', 'rgb')
}
function setBackground(color) {
	elem('underlay').style.backgroundColor = color
	if (elem('toolbox').style.display == 'block') makeTranslucent(elem('underlay'))
	elem('netBackColorWell').style.backgroundColor = color
}

function toggleDrawingLayer() {
	drawingSwitch = elem('toolbox').style.display == 'block'
	let ul = elem('underlay')
	if (drawingSwitch) {
		// close drawing layer
		deselectTool()
		elem('toolbox').style.display = 'none'
		elem('underlay').style.zIndex = 0
		makeSolid(ul)
		elem('temp-canvas').style.zIndex = 0
		elem('chatbox-tab').classList.remove('chatbox-hide')
		inAddMode = false
		setButtonDisabledStatus('addNode', false)
		setButtonDisabledStatus('addLink', false)
		undoRedoButtonStatus()
		changeCursor('default')
	} else {
		// expose drawing layer
		elem('toolbox').style.display = 'block'
		ul.style.zIndex = 1000
		ul.style.cursor = 'default'
		elem('temp-canvas').style.zIndex = 1000
		// make the underlay (which is now overlay) translucent
		makeTranslucent(ul)
		minimize()
		elem('chatbox-tab').classList.add('chatbox-hide')
		inAddMode = 'disabled'
		setButtonDisabledStatus('addNode', true)
		setButtonDisabledStatus('addLink', true)
		setButtonDisabledStatus('undo', true)
		setButtonDisabledStatus('redo', true)
	}
	drawingSwitch = !drawingSwitch
	network.redraw()
}
function ensureNotDrawing() {
	if (!drawingSwitch) return
	toggleDrawingLayer()
	elem('drawing').checked = false
}

function selectAllFactors() {
	selectFactors(data.nodes.getIds({filter: (n) => !n.hidden}))
}

export function selectFactors(nodeIds) {
	network.selectNodes(nodeIds, false)
	showSelected()
}

function selectAllLinks() {
	selectLinks(data.edges.getIds({filter: (e) => !e.hidden}))
}

export function selectLinks(edgeIds) {
	network.selectEdges(edgeIds)
	showSelected()
}

function legendSwitch(e) {
	let on = e.target.checked
	setLegend(on, true)
	yNetMap.set('legend', on)
}
function setLegend(on, warn) {
	elem('showLegendSwitch').checked = on
	if (on) legend(warn)
	else clearLegend()
}
/************************************************************** Analysis tab ************************************************* */

/**
 *
 * @param {String} name of Radio button group
 * @returns value of the button that is checked
 */
function getRadioVal(name) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name)
	// loop through list of radio buttons
	for (let i = 0, len = radios.length; i < len; i++) {
		if (radios[i].checked) return radios[i].value
	}
}
/**
 *
 * @param {String} name of the radio button group
 * @param {*} value check the button with this value
 */
function setRadioVal(name, value) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name)
	// loop through list of radio buttons and set the check on the one with the value
	for (let i = 0, len = radios.length; i < len; i++) {
		radios[i].checked = radios[i].value == value
	}
}
/**
 * Return an array of the node Ids of Factors that are selected of are locked
 * @returns Array
 */
function getSelectedAndFixedNodes() {
	return [
		...new Set(
			network.getSelectedNodes().concat(
				data.nodes
					.get()
					.filter((n) => n.fixed)
					.map((n) => n.id)
			)
		),
	]
}

/**
 * Sets the Analysis radio buttons and Factor selection according to values in global hiddenNodes
 *  (which is set when yNetMap is loaded, or when a file is read in)
 */
function setAnalysisButtonsFromRemote() {
	if (netLoaded) {
		let selectedNodes = [].concat(hiddenNodes.selected) // ensure that hiddenNodes.selected is an array
		if (selectedNodes.length > 0) {
			network.selectNodes(selectedNodes, false) // in viewing  only mode, this does nothing
			if (!viewOnly) statusMsg(listFactors(getSelectedAndFixedNodes()) + ' selected')
		}
		if (hiddenNodes.radiusSetting) setRadioVal('radius', hiddenNodes.radiusSetting)
		if (hiddenNodes.streamSetting) setRadioVal('stream', hiddenNodes.streamSetting)
		if (hiddenNodes.pathsSetting) setRadioVal('paths', hiddenNodes.pathsSetting)
	}
}

function setYMapAnalysisButtons() {
	let selectedNodes = getSelectedAndFixedNodes()
	yNetMap.set('radius', {
		radiusSetting: getRadioVal('radius'),
		selected: selectedNodes,
	})
	yNetMap.set('stream', {
		streamSetting: getRadioVal('stream'),
		selected: selectedNodes,
	})
	yNetMap.set('paths', {
		pathsSetting: getRadioVal('paths'),
		selected: selectedNodes,
	})
}
/**
 * Hide factors and links to show only those closest to the selected factors and/or
 * those up/downstream and/or those on paths between the selected factors
 */
function analyse() {
	let selectedNodes = getSelectedAndFixedNodes()
	setYMapAnalysisButtons()
	// get all nodes and edges and unhide them before hiding those not wanted to be visible
	let nodes = data.nodes
		.get()
		.filter((n) => !n.isCluster)
		.map((n) => {
			n.hidden = false
			return n
		})
	let edges = data.edges
		.get()
		.filter((e) => !e.isClusterEdge)
		.map((e) => {
			e.hidden = false
			return e
		})
	// if showing everything, we are done
	if (getRadioVal('radius') == 'All' && getRadioVal('stream') == 'All' && getRadioVal('paths') == 'All') {
		setYMapAnalysisButtons()
		data.nodes.update(nodes)
		data.edges.update(edges)
		showSelected()
		return
	}

	// check that at least one factor is selected
	if (selectedNodes.length == 0 && getRadioVal('paths') == 'All') {
		statusMsg('A Factor needs to be selected', 'error')
		setRadioVal('radius', 'All')
		setRadioVal('stream', 'All')
		setRadioVal('paths', 'All')
		setYMapAnalysisButtons()
		data.nodes.update(nodes)
		data.edges.update(edges)
		return
	}
	// but paths between factors needs at least two
	if (getRadioVal('paths') !== 'All' && selectedNodes.length < 2) {
		statusMsg('Select at least 2 factors to show paths between them', 'error')
		setRadioVal('paths', 'All')
		setYMapAnalysisButtons()
		data.nodes.update(nodes)
		data.edges.update(edges)
		return
	}

	// these operations are not commutative (at least for networks with loops), so do them all in order
	if (getRadioVal('radius') !== 'All') hideNodesByRadius(selectedNodes, parseInt(getRadioVal('radius')))
	if (getRadioVal('stream') !== 'All') hideNodesByStream(selectedNodes, getRadioVal('stream'))
	if (getRadioVal('paths') !== 'All') hideNodesByPaths(selectedNodes, getRadioVal('paths'))

	// finally display the map with its hidden factors and edges
	data.nodes.update(nodes)
	data.edges.update(edges)

	// announce what has been done
	let streamMsg = ''
	if (getRadioVal('stream') == 'upstream') streamMsg = 'upstream'
	if (getRadioVal('stream') == 'downstream') streamMsg = 'downstream'
	let radiusMsg = ''
	if (getRadioVal('radius') == '1') radiusMsg = 'within one link'
	if (getRadioVal('radius') == '2') radiusMsg = 'within two links'
	if (getRadioVal('radius') == '3') radiusMsg = 'within three links'
	let pathsMsg = ''
	if (getRadioVal('paths') == 'allPaths') pathsMsg = ': showing all paths'
	if (getRadioVal('paths') == 'shortestPath') pathsMsg = ': showing shortest paths'
	if (getRadioVal('stream') == 'All' && getRadioVal('radius') == 'All')
		statusMsg(
			`Showing  ${getRadioVal('paths') == 'allPaths' ? 'all paths' : 'shortest paths'} between ${listFactors(
				getSelectedAndFixedNodes(),
				true
			)}`
		)
	else
		statusMsg(
			`Factors ${streamMsg} ${streamMsg && radiusMsg ? ' and ' : ''} ${radiusMsg} of ${listFactors(
				getSelectedAndFixedNodes(),
				true
			)}${pathsMsg}`
		)

	/**
	 * Hide factors that are more than radius links distant from those selected
	 * @param {string[]} selectedNodes
	 * @param {Integer} radius
	 */
	function hideNodesByRadius(selectedNodes, radius) {
		let nodeIdsInRadiusSet = new Set()
		let linkIdsInRadiusSet = new Set()

		// put those factors and links within radius links into these sets
		if (getRadioVal('stream') == 'upstream' || getRadioVal('stream') == 'All') inSet(selectedNodes, radius, 'to')
		if (getRadioVal('stream') == 'downstream' || getRadioVal('stream') == 'All')
			inSet(selectedNodes, radius, 'from')

		// hide all nodes and edges not in radius
		nodes.forEach((n) => {
			if (!nodeIdsInRadiusSet.has(n.id)) n.hidden = true
		})
		edges.forEach((e) => {
			if (!linkIdsInRadiusSet.has(e.id)) e.hidden = true
		})
		// add links between factors that are in radius set, to give an ego network
		nodeIdsInRadiusSet.forEach((f) => {
			network.getConnectedEdges(f).forEach((e) => (data.edges.get(e).hidden = false))
		})

		/**
		 * recursive function to collect Factors and Links within radius links from any of the nodes listed in nodeIds
		 * Factor ids are collected in nodeIdsInRadiusSet and links in linkIdsInRadiusSet
		 * Links are followed in a consistent direction, i.e. if 'to', only links directed away from the the nodes are followed
		 * @param {string[]} nodeIds
		 * @param {number} radius
		 * @param {string} direction - either 'from' or 'to'
		 */
		function inSet(nodeIds, radius, direction) {
			if (radius < 0) return
			nodeIds.forEach((nId) => {
				let linked = []
				nodeIdsInRadiusSet.add(nId)
				let links = network.getConnectedEdges(nId).filter((e) => data.edges.get(e)[direction] === nId)
				if (links && radius > 0)
					links.forEach((lId) => {
						linkIdsInRadiusSet.add(lId)
						linked.push(data.edges.get(lId)[direction == 'to' ? 'from' : 'to'])
					})
				if (linked) inSet(linked, radius - 1, direction)
			})
		}
	}
	/**
	 * Hide factors that are not up or downstream from the selected factors.
	 * Does not include links or factors that are already hidden
	 * @param {string[]} selectedNodes
	 * @param {string} direction - 'upstream' or 'downstream'
	 */
	function hideNodesByStream(selectedNodes, upOrDown) {
		let nodeIdsInStreamSet = new Set()
		let linkIdsInStreamSet = new Set()

		let radiusVal = getRadioVal('radius')
		let radius = Infinity
		if (radiusVal !== 'All') {
			radius = parseInt(radiusVal)
		}
		let direction = 'to'
		if (upOrDown == 'upstream') direction = 'from'

		// breadth first search for all Factors that are downstream and less than or equal to radius links away
		data.nodes.map((n) => (n.level = undefined))
		selectedNodes.forEach((nodeId) => {
			nodeIdsInStreamSet.add(nodeId)
			let node = data.nodes.get(nodeId)
			let q = [node]
			let level = 0
			node.level = 0
			while (q.length > 0 && level <= radius) {
				let currentNode = q.shift()
				let connectedNodes = data.nodes
					.get(network.getConnectedNodes(currentNode.id, direction))
					.filter((n) => !n.hidden && !nodeIdsInStreamSet.has(n.id))
				if (connectedNodes.length > 0) {
					level = currentNode.level + 1
					connectedNodes.forEach((n) => {
						nodeIdsInStreamSet.add(n.id)
						n.level = level
					})
					q = q.concat(connectedNodes)
				}
			}
		})

		// hide all nodes and edges not up or down stream
		nodes.forEach((n) => {
			if (!nodeIdsInStreamSet.has(n.id)) n.hidden = true
		})
		edges.forEach((e) => {
			if (!linkIdsInStreamSet.has(e.id)) e.hidden = true
		})

		// add links between factors that are in radius set, to give an ego network
		nodeIdsInStreamSet.forEach((f) => {
			network.getConnectedEdges(f).forEach((e) => (data.edges.get(e).hidden = false))
		})
	}

	/**
	 * Hide all factors and links that are not on the shortest path (or all paths) between the selected factors
	 * Avoids factors or links that are hidden
	 * @param {string[]} selectedNodes
	 * @param {string} pathType - either 'allPaths' or 'shortestPath'
	 */
	function hideNodesByPaths(selectedNodes, pathType) {
		// paths is an array of objects with from and to node ids, or an empty array of there is no path
		let paths = shortestPaths(selectedNodes, pathType === 'allPaths')
		if (paths.length == 0) {
			statusMsg('No path between the selected Factors', 'info')
			setRadioVal('paths', 'All')
			setYMapAnalysisButtons()
			return
		}
		// hide nodes and links that are not included in paths
		let nodeIdsInPathsSet = new Set()
		let linkIdsInPathsSet = new Set()

		paths.forEach((links) => {
			links.forEach((link) => {
				let edge = data.edges.get({filter: (e) => e.to === link.to && e.from === link.from})[0]
				linkIdsInPathsSet.add(edge.id)
				nodeIdsInPathsSet.add(edge.from)
				nodeIdsInPathsSet.add(edge.to)
			})
		})
		// hide all factors and links that are not in the set of paths
		nodes.forEach((n) => {
			if (!nodeIdsInPathsSet.has(n.id)) n.hidden = true
		})
		edges.forEach((e) => {
			if (!linkIdsInPathsSet.has(e.id)) e.hidden = true
		})

		/**
		 * Given two or more selected factors, return a list of all the links that are either on any path between them, or just the ones on the shortest paths between them
		 * @param {Boolean} all when true, find all the links that connect to the selected factors; when false, find the shortest paths between the selected factors
		 * @returns	Arrays of objects with from: and to: properties for all the links (an empty array if there is no path between any of the selected factors)
		 */
		function shortestPaths(selectedNodes, all) {
			let visited = new Map()
			let allPaths = []
			// list of all pairs of the selected factors
			let combos = selectedNodes.flatMap((v, i) => selectedNodes.slice(i + 1).map((w) => [v, w]))
			// for each pair, find the sequences of links in both directions and combine them
			combos.forEach((combo) => {
				let source = combo[0]
				let dest = combo[1]
				let links = pathList(source, dest, all)
				if (links.length > 0) allPaths.push(links)
				links = pathList(dest, source, all)
				if (links.length > 0) allPaths.push(links)
			})
			return allPaths

			/**
			 * find the paths (as a list of links) that connect the source and destination
			 * @param {String} source
			 * @param {String} dest
			 * @param {Boolean} all true of all paths between Source and Destination are wanted; false if just the shortest path
			 * @returns an array of lists of links that connect the paths
			 */
			function pathList(source, dest, all) {
				visited.clear()
				let links = []
				let paths = getPaths(source, dest)
				// if no path found, getPaths return an array of length greater than the total number of factors in the map, or a string
				// in this case, return an empty list
				if (!Array.isArray(paths) || paths.length === data.nodes.length + 1) paths = []
				if (!all) {
					for (let i = 0; i < paths.length - 1; i++) {
						links.push({from: paths[i], to: paths[i + 1]})
					}
				}
				return links
				/**
				 * recursively explore the map starting from source until destination is reached.
				 * stop if a factor has already been visited, or at a dead end (zero out-degree)
				 * @param {String} source
				 * @param {String} dest
				 * @returns an array of factors, the path so far followed
				 */
				function getPaths(source, dest) {
					if (source === dest) return [dest]
					visited.set(source, true)
					let path = [source]
					// only consider nodes and edges that are not hidden
					let connectedNodes = network
						.getConnectedEdges(source)
						.filter((e) => {
							let edge = data.edges.get(e)
							return !edge.hidden && edge.from == source
						})
						.map((e) => data.edges.get(e).to)
					if (connectedNodes.length === 0) return 'deadend'
					if (all) {
						// all paths between the source and destination
						connectedNodes.forEach((next) => {
							let vis = visited.get(next)
							if (vis === 'onpath') {
								links.push({from: source, to: next})
								path = path.concat([next])
							} else if (!vis) {
								let p = getPaths(next, dest)
								if (Array.isArray(p) && p.length > 0) {
									links.push({from: source, to: next})
									visited.set(next, 'onpath')
									path = path.concat(p)
								}
							}
						})
					} else {
						// shortest path between the source and destination
						let bestPath = []
						let bestPathLength = data.nodes.length
						connectedNodes.forEach((next) => {
							let p = visited.get(next)
							if (!p) {
								p = getPaths(next, dest)
								visited.set(next, p)
							}
							if (Array.isArray(p) && p.length > 0) {
								if (p.length < bestPathLength) {
									bestPath = p
									bestPathLength = p.length
								}
							}
						})
						path = path.concat(bestPath)
					}
					// if no progress has been made (the path is just the initial source factor), return an empty path
					if (path.length == 1) path = []
					return path
				}
			}
		}
	}
}

function sizingSwitch(e) {
	let metric = e.target.value
	sizing(metric)
	yNetMap.set('sizing', metric)
}

/**
 * set the size of the nodes proportional to the selected metric
 * @param {String} metric none, in degree, out degree or betweenness centrality
 */
function sizing(metric) {
	let nodesToUpdate = []
	data.nodes.forEach((node) => {
		node.scaling.label.enabled = true
		switch (metric) {
			case 'Off':
				node.scaling.label.enabled = false
				node.value = 0
				break
			case 'Inputs':
				node.value = network.getConnectedNodes(node.id, 'from').length
				break
			case 'Outputs':
				node.value = network.getConnectedNodes(node.id, 'to').length
				break
			case 'Leverage': {
				let inDegree = network.getConnectedNodes(node.id, 'from').length
				let outDegree = network.getConnectedNodes(node.id, 'to').length
				node.value = inDegree == 0 ? 0 : outDegree / inDegree
				break
			}
			case 'Centrality':
				node.value = node.bc
				break
		}
		nodesToUpdate.push(node)
	})
	data.nodes.update(nodesToUpdate)
	elem('sizing').value = metric
	network.fit()
	elem('zoom').value = network.getScale()
}

// Note: most of the clustering functionality is in cluster.js
/**
 * User has chosen a clustering option
 * @param {Event} e
 */
function selectClustering(e) {
	let option = e.target.value
	// it doesn't make much sense to cluster while the factors are hidden, so undo that
	setRadioVal('radius', 'All')
	setRadioVal('stream', 'All')
	setRadioVal('paths', 'All')
	setYMapAnalysisButtons()
	doc.transact(() => {
		data.nodes.update(
			data.nodes.get().map((n) => {
				n.hidden = false
				return n
			})
		)
		data.edges.update(
			data.edges.get().map((e) => {
				e.hidden = false
				return e
			})
		)
	})
	cluster(option)
	fit(0)
	yNetMap.set('cluster', option)
}
function setCluster(option) {
	elem('clustering').value = option
}
/**
 * recreate the Clustering drop down menu to include user attributes as clustering options
 * @param {object} obj {menu value, menu text}
 */
function recreateClusteringMenu(obj) {
	// remove any old select items, other than the standard ones (which are the first 3: None, Style, Color)
	let select = elem('clustering')
	for (let i = 3, len = select.options.length; i < len; i++) {
		select.remove(3)
	}
	// append the ones provided
	for (const property in obj) {
		if (obj[property] !== '*deleted*') {
			let opt = document.createElement('option')
			opt.value = property
			opt.text = obj[property]
			select.add(opt, null)
		}
	}
}
/*****************************************************************chat window ******************************************************************/

var emojiPicker = null

function minimize() {
	if (emojiPicker) emojiPicker.destroyPicker()
	chatbox.classList.add('chatbox-hide')
	chatboxTab.classList.remove('chatbox-hide')
	chatboxTab.classList.remove('chatbox-blink')
}

function maximize() {
	chatboxTab.classList.add('chatbox-hide')
	chatboxTab.classList.remove('chatbox-blink')
	chatbox.classList.remove('chatbox-hide')
	const emojiButton = document.querySelector('#emoji-button')
	emojiPicker = new EmojiButton({
		rootElement: chatbox,
		zIndex: 1000,
	})
	emojiPicker.on('emoji', (selection) => {
		document.querySelector('#chat-input').value += selection.emoji
	})
	emojiButton.addEventListener('click', () => {
		emojiPicker.togglePicker(emojiButton)
	})
	displayUserName()
	displayAllMsgs()
}

function blinkChatboxTab() {
	if (yChatArray.length > 0) chatboxTab.classList.add('chatbox-blink')
}

function sendMsg() {
	let inputMsg = chatInput.value.replace(/\n/g, '</br>')
	yChatArray.push([
		{
			client: clientID,
			author: myNameRec.name,
			recipient: elem('chat-users').value,
			time: Date.now(),
			msg: inputMsg,
		},
	])
	chatInput.value = ''
}

function displayLastMsg() {
	displayMsg(yChatArray.get(yChatArray.length - 1))
}

function displayAllMsgs() {
	chatMessages.innerHTML = ''
	for (let m = 0; m < yChatArray.length; m++) {
		displayMsg(yChatArray.get(m))
	}
	chatMessages.scrollTop = chatMessages.scrollHeight
}

function displayMsg(msg) {
	if (msg == undefined) return
	let clock = Number.isInteger(msg.time) ? timeAndDate(msg.time) : ''
	if (msg.client == clientID) {
		// my own message
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-time">${clock}</span>
			</div>
			<div class="message-box">
				${msg.msg}
			</div>
		</div>`
	} else {
		// show only messages with no recipient (as from an old version), everyone or me
		if (
			msg.recipient == undefined ||
			msg.recipient == '' ||
			msg.recipient == myNameRec.name.replace(/\s+/g, '').toLowerCase()
		) {
			blinkChatboxTab()
			chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-author">${msg.author}</span><span class="message-time">${clock}</span> 
			</div>
			<div class="message-box message-received">
				${msg.msg}
			</div>
		</div>`
		}
	}
	chatMessages.scrollTop = chatMessages.scrollHeight
}

function displayUserName() {
	chatNameBox.style.fontStyle = myNameRec.anon ? 'italic' : 'normal'
	chatNameBox.value = myNameRec.name
}

/**
 * Create a set of options for the select menu of the currently online users
 * @param {Array} names - array of name records from yAwareness (see showAvatars)
 */
// cache menu to avoid expensive DOM operations
let oldUserNames = []
function populateChatUserMenu(names) {
	let userNames = names.map((nRec) => nRec.name)
	if (object_equals(oldUserNames, userNames)) return
	oldUserNames = userNames
	let options = '<option value="">Everyone</option>'
	userNames.forEach((name) => {
		options += `<option value=${name.replace(/\s+/g, '').toLowerCase()}>${name}</option>`
	})
	elem('chat-users').innerHTML = options
}

dragElement(elem('chatbox-holder'), elem('chatbox-top'))

/* ---------------------------------------history window --------------------------------*/
/**
 * display the history log in a window
 */
function showHistory() {
	elem('history-window').style.display = 'block'
	let log = elem('history-log')
	log.innerHTML = yHistory
		.toArray()
		.map((rec) => formatLogRec(rec))
		.join(' ')
	document.querySelectorAll('div.history-rollback').forEach((e) => {
		if (e.id) listen(e.id, 'click', rollback)
	})
	log.lastChild.scrollIntoView(false)
}
/**
 * return a DOM element with the data in rec formatted and a button for rolling back if there is state data
 * @param {Object} rec - history record (action, time, state)
 */
function formatLogRec(rec) {
	let rollbackButton = '<div class="history-rollback"></div>'
	if (rec.state) {
		rollbackButton = `<div class="history-rollback"  id="hist${rec.time}">
			<div class="tooltip">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bootstrap-reboot" viewBox="0 0 16 16">
				<path d="M1.161 8a6.84 6.84 0 1 0 6.842-6.84.58.58 0 1 1 0-1.16 8 8 0 1 1-6.556 3.412l-.663-.577a.58.58 0 0 1 .227-.997l2.52-.69a.58.58 0 0 1 .728.633l-.332 2.592a.58.58 0 0 1-.956.364l-.643-.56A6.812 6.812 0 0 0 1.16 8z"/>
				<path d="M6.641 11.671V8.843h1.57l1.498 2.828h1.314L9.377 8.665c.897-.3 1.427-1.106 1.427-2.1 0-1.37-.943-2.246-2.456-2.246H5.5v7.352h1.141zm0-3.75V5.277h1.57c.881 0 1.416.499 1.416 1.32 0 .84-.504 1.324-1.386 1.324h-1.6z"/>
				</svg>
				<span class="tooltiptext rollbacktip">Rollback to before this action</span>
			</div>
		</div>`
	}
	return `<div class="history-time">${timeAndDate(rec.time)}: </div>
			<div class="history-action">${rec.user} ${rec.action}</div>
			${rollbackButton}`
}
/**
 *
 * @param {Event} event
 * @returns null if no rollback possible or cancelled
 */
function rollback(event) {
	let rbTime = parseInt(event.currentTarget.id.substring(4))
	let rb = yHistory.toArray().find((rec) => rec.time === rbTime)
	if (!rb || !rb.state) return
	if (!confirm(`Roll back the map to what it was before ${timeAndDate(rbTime)}?`)) return
	let state = JSON.parse(decompressFromUTF16(rb.state))
	data.nodes.clear()
	data.edges.clear()
	data.nodes.update(state.nodes)
	data.edges.update(state.edges)
	for (const k in state.net) {
		yNetMap.set(k, state.net[k])
	}
	logHistory(`rolled back the map to what it was before ${timeAndDate(rbTime, true)}`)
}

function showHistorySwitch() {
	if (elem('showHistorySwitch').checked) showHistory()
	else elem('history-window').style.display = 'none'
}
listen('history-close', 'click', historyClose)
function historyClose() {
	elem('history-window').style.display = 'none'
	elem('showHistorySwitch').checked = false
}

dragElement(elem('history-window'), elem('history-header'))

/* --------------------------------------- avatars and shared cursors--------------------------------*/
/**
 *  set up user monitoring (awareness)
 */
function setUpAwareness() {
	showAvatars()
	// eslint-disable-next-line no-unused-vars
	yAwareness.on('change', (event) => {
		if (/aware/.test(debug)) traceUsers(event)
		showGhostFactor()
		if (elem('showUsersSwitch').checked) {
			showMice()
			showAvatars()
			followUser()
		}
	})
	// regularly broadcast our own state, every 20 seconds
	setInterval(() => yAwareness.setLocalState(yAwareness.getLocalState()), 20000)
	// fade out avatar when there has been no movement of the mouse for 15 minutes
	asleep(false)
	var sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP)
	window.addEventListener('mousemove', (e) => {
		clearTimeout(sleepTimer)
		asleep(false)
		sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP)
		// broadcast current position of mouse in canvas coordinates
		let box = netPane.getBoundingClientRect()
		yAwareness.setLocalStateField(
			'cursor',
			network.DOMtoCanvas({
				x: e.clientX - box.left,
				y: e.clientY - box.top,
			})
		)
	})
}
/**
 * Set the awareness local state to show whether this client is sleeping (no mouse movement for 15 minutes)
 * @param {Boolean} isSleeping
 */
function asleep(isSleeping) {
	if (myNameRec.asleep === isSleeping) return
	myNameRec.asleep = isSleeping
	yAwareness.setLocalState({user: myNameRec})
	showAvatars()
}
function traceUsers(event) {
	let msg = ''
	event.added.forEach((id) => {
		msg += `Added ${user(id)} (${id}) `
	})
	event.updated.forEach((id) => {
		msg += `Updated ${user(id)} (${id}) `
	})
	event.removed.forEach((id) => {
		msg += `Removed (${id}) `
	})
	console.log('yAwareness', exactTime(), msg)

	function user(id) {
		let userRec = yAwareness.getStates().get(id)
		return isEmpty(userRec.user) ? id : userRec.user.name
	}
}
/**
 * Display the other users' mouse pointers (if they are inside the canvas)
 */
function showMice() {
	let recs = Array.from(yAwareness.getStates())
	let box = netPane.getBoundingClientRect()
	recs.forEach(([key, value]) => {
		if (key != clientID && value.cursor) {
			let cursorDiv = elem(key.toString())
			if (cursorDiv) {
				let p = network.canvasToDOM(value.cursor)
				p.x += box.left
				p.y += box.top
				cursorDiv.style.top = `${p.y}px`
				cursorDiv.style.left = `${p.x}px`
				cursorDiv.style.display =
					p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top ? 'none' : 'block'
			}
		}
	})
}
/**
 * Place a circle at the top left of the net pane to represent each user who is online
 * Also create a cursor (a div) for each of the users
 */
let previousNames = []
function showAvatars() {
	let recs = Array.from(yAwareness.getStates())
	// remove and save myself (using clientID as the id, not name)
	let me = recs.splice(
		recs.findIndex((a) => a[0] === clientID),
		1
	)
	let names = recs
		// eslint-disable-next-line no-unused-vars
		.map(([key, value]) => {
			if (value.user) return value.user
		})
		.filter((e) => e) // remove any recs without a user record
		.filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i) // remove duplicates, by name
		.sort((a, b) => (a.name.charAt(0).toUpperCase() > b.name.charAt(0).toUpperCase() ? 1 : -1)) // sort names

	populateChatUserMenu(Array.from(names))

	if (me.length == 0) return // app is unloading
	names.unshift(me[0][1].user) // push myself on to the front
	// if nothing has changed, just return
	if (object_equals(previousNames, names)) return
	previousNames = deepCopy(names)

	let avatars = elem('avatars')
	let currentCursors = []

	// clear out all avatars from the display
	Array.from(avatars.children).forEach((e) => e.remove())

	names.forEach((nameRec) => {
		let ava = elem('ava' + nameRec.id)
		let shortName = initials(nameRec.name)
		if (ava == null) {
			ava = document.createElement('div')
			ava.classList.add('hoverme')
			if (followme === nameRec.id) ava.classList.add('followme')
			ava.id = 'ava' + nameRec.id
			ava.dataset.tooltip = nameRec.name
			let circle = document.createElement('div')
			circle.classList.add('round')
			circle.style.backgroundColor = nameRec.color
			if (nameRec.anon) circle.style.borderColor = 'white'
			circle.innerText = shortName
			circle.style.opacity = nameRec.asleep ? 0.2 : 1.0
			circle.dataset.client = nameRec.id
			ava.appendChild(circle)
			avatars.appendChild(ava)
			circle.addEventListener('click', follow)
		} else {
			// to avoid flashes, don't touch anything that is already correct
			if (ava.dataset.tooltip != nameRec.name) ava.dataset.tooltip = nameRec.name
			let circle = ava.firstChild
			if (circle.style.backgroundColor != nameRec.color) circle.style.backgroundColor = nameRec.color
			let circleBorderColor = nameRec.anon ? 'white' : 'black'
			if (circle.style.borderColor != circleBorderColor) circle.style.borderColor = circleBorderColor
			if (circle.innerText != shortName) circle.innerText = shortName
			let opacity = nameRec.asleep ? 0.2 : 1.0
			if (circle.style.opacity != opacity) circle.style.opacity = opacity
			avatars.appendChild(ava)
		}

		if (nameRec.id != clientID) {
			// don't create a cursor for myself
			let cursorDiv = elem(nameRec.id)
			if (cursorDiv == null) {
				cursorDiv = document.createElement('div')
				cursorDiv.className = 'shared-cursor'
				cursorDiv.id = nameRec.id
				cursorDiv.style.backgroundColor = nameRec.color
				cursorDiv.innerText = shortName
				cursorDiv.style.display = 'none'
				container.appendChild(cursorDiv)
			} else {
				if (nameRec.asleep) cursorDiv.style.display = 'none'
				if (cursorDiv.innerText != shortName) cursorDiv.innerText = shortName
				if (cursorDiv.style.backgroundColor != nameRec.color) cursorDiv.style.backgroundColor = nameRec.color
			}
			currentCursors.push(cursorDiv)
		}
	})
	// delete any cursors that remain from before
	let cursorsToDelete = Array.from(document.querySelectorAll('.shared-cursor')).filter(
		(a) => !currentCursors.includes(a)
	)
	cursorsToDelete.forEach((e) => e.remove())
}

function showUsersSwitch() {
	let on = elem('showUsersSwitch').checked
	document.querySelectorAll('div.shared-cursor').forEach((node) => {
		node.style.display = on ? 'block' : 'none'
	})
	elem('avatars').style.display = on ? 'flex' : 'none'
}
/**
 * User has clicked on an avatar.  Start following this avatar
 * @param {event} event
 */
function follow(event) {
	if (followme) unFollow()
	let user = parseInt(event.target.dataset.client, 10)
	if (user == clientID) return
	followme = user
	elem('ava' + followme).classList.add('followme')
	let userName = elem('ava' + user).dataset.tooltip
	statusMsg(`Following ${userName}`, 'info')
}
/**
 * User was following another user, but has now clicked off the avatar, so stop following
 */
function unFollow() {
	if (!followme) return
	elem('ava' + followme).classList.remove('followme')
	followme = undefined
	clearStatusBar()
}
/**
 * move the map so that the followed cursor is always in the centre of the pane
 */
function followUser() {
	if (!followme) return
	let userRec = yAwareness.getStates().get(followme)
	if (!userRec) return
	if (userRec.user.asleep) unFollow()
	let userPosition = userRec.cursor
	if (userPosition) network.moveTo({position: userPosition})
}
/**
 * show a ghost box where another user is adding a factor
 * addingFactor can be: a position (of the Add Factor dialog); 'done' to indicate
 * that the ghost box should be removed; or false - do nothing
 *
 */
function showGhostFactor() {
	let recs = Array.from(yAwareness.getStates())
	recs.forEach(([key, value]) => {
		if (key != clientID && value.addingFactor) {
			let id = `ghost-factor${key}`
			switch (value.addingFactor) {
				case 'done':
					{
						let ghostDiv = elem(id)
						if (ghostDiv) ghostDiv.remove()
						value.addingFactor = false
					}
					break
				case false:
					break
				default: {
					if (!elem(id)) {
						let ghostDiv = document.createElement('div')
						ghostDiv.className = 'ghost-factor'
						ghostDiv.id = `ghost-factor${key}`
						ghostDiv.innerText = `[New factor\nbeing added by\n${value.user.name}]`
						let p = network.canvasToDOM(value.addingFactor)
						let box = container.getBoundingClientRect()
						p.x += box.left
						p.y += box.top
						ghostDiv.style.top = `${p.y - 50}px`
						ghostDiv.style.left = `${p.x - 187}px`
						ghostDiv.style.display =
							p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top ? 'none' : 'block'
						netPane.appendChild(ghostDiv)
					}
				}
			}
		}
	})
}
