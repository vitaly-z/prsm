/********************************************************************************************* 

PRSM Participatory System Mapper 

MIT License

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


This module provides the background objet-oriented drawing for PRSM
********************************************************************************************/

import {doc, yDrawingMap, network, cp, drawingSwitch, yPointsArray, fit} from './prsm.js'
import {fabric} from 'fabric'
import {elem, listen, uuidv4, deepCopy, dragElement, statusMsg} from '../js/utils.js'

// essential to prevent scaling of borders
fabric.Object.prototype.noScaleCache = false

// create a wrapper around native canvas element
export var canvas = new fabric.Canvas('drawing-canvas', {enablePointerEvents: true, stopContextMenu: true})
window.canvas = canvas

let selectedTool = null //the id of the currently selected tool
let currentObject = null // the object implementing the tool currently selected, if any

var undos = [] // stack of user changes to objects for undo
var redos = [] // stack of undos for redoing

/**
 * Initialise the canvas and toolbox
 */
export function setUpBackground() {
	resizeCanvas()
	initDraw()
}
listen('drawing-canvas', 'keydown', checkKey)

/**
 * resize the drawing canvas when the window changes size
 */
export function resizeCanvas() {
	let underlay = elem('underlay')
	let oldWidth = canvas.getWidth()
	let oldHeight = canvas.getHeight()
	zoomCanvas(1.0)
	canvas.setHeight(underlay.offsetHeight)
	canvas.setWidth(underlay.offsetWidth)
	canvas.calcOffset()
	panCanvas((canvas.getWidth() - oldWidth) / 2, (canvas.getHeight() - oldHeight) / 2, 1.0)
	zoomCanvas(network ? network.getScale() : 1)
	canvas.requestRenderAll()
}

/**
 * zoom the canvas, zooming from the canvas centre
 * @param {float} zoom
 */
export function zoomCanvas(zoom) {
	canvas.zoomToPoint({x: canvas.getWidth() / 2, y: canvas.getHeight() / 2}, zoom)
}

export function panCanvas(x, y, zoom) {
	zoom = zoom || network.getScale()
	canvas.relativePan(new fabric.Point(x * zoom, y * zoom))
}

/**
 * set up the fabric context, the grid drawn on it and the tools
 */
function initDraw() {
	fabric.Object.prototype.set({
		transparentCorners: false,
		cornerColor: 'blue',
		cornerSize: 5,
		cornerStyle: 'circle',
	})
	if (drawingSwitch) drawGrid()
	setUpToolbox()
	canvas.setViewportTransform([1, 0, 0, 1, canvas.getWidth() / 2, canvas.getHeight() / 2])
	initAligningGuidelines()
}
/**
 * redraw the objects on the canvas and the grid
 */
export function redraw() {
	canvas.requestRenderAll()
	if (drawingSwitch) drawGrid()
}

/**
 * observe remote changes, sent as a set of parameters that are used to update
 * the existing or new basic Fabric objects
 * Also import the remote undo and redo stacks
 *
 * @param {object} event
 */
export function updateFromRemote(event) {
	if (event.transaction.local === false && event.keysChanged.size > 0) {
		//oddly, keys changed includes old, cleared keys, so use this instead.
		refreshFromMap([...event.changes.keys.keys()])
	}
}
/**
 * add or refresh objects that have the given list of id, using data in yDrawingMap
 * @param {array} keys
 */
export function refreshFromMap(keys) {
	canvas.discardActiveObject()
	for (let key of keys) {
		/* active Selection and group have to be dealt with last, because they reference objects that may
		 * not have been put on the canvas yet */
		let remoteParams = yDrawingMap.get(key)
		if (!remoteParams) {
			console.error('Empty remoteParams in refreshFromMap()', key)
			continue
		}
		switch (key) {
			case 'undos': {
				undos = deepCopy(remoteParams)
				updateActiveButtons()
				continue
			}
			case 'redos': {
				redos = deepCopy(remoteParams)
				updateActiveButtons()
				continue
			}
			case 'activeSelection': {
				continue
			}
			default: {
				let localObj = canvas.getObjects().find((o) => o.id === key)
				// if object already exists, update it
				if (localObj) {
					if (remoteParams.type === 'ungroup') {
						localObj.toActiveSelection()
						canvas.discardActiveObject()
					} else localObj.setOptions(remoteParams)
				} else {
					// create a new object
					switch (remoteParams.type) {
						case 'rect':
							localObj = new RectHandler()
							break
						case 'circle':
							localObj = new CircleHandler()
							break
						case 'line':
							localObj = new LineHandler()
							break
						case 'text':
							localObj = new TextHandler()
							break
						case 'path':
							localObj = new fabric.Path()
							break
						case 'image':
							fabric.Image.fromObject(remoteParams.imageObj, (image) => {
								image.setCoords()
								image.id = key
								canvas.add(image)
							})
							continue
						case 'group': {
							continue
						}
						case 'activeSelection':
							if (canvas.getActiveObject())
								canvas.getActiveObject().set({
									angle: remoteParams.angle,
									left: remoteParams.left,
									scaleX: remoteParams.scaleX,
									scaleY: remoteParams.scaleY,
									top: remoteParams.top,
								})
							continue
						case 'selection':
							continue
						case 'ungroup':
							continue
						default:
							throw `bad fabric object type in yDrawingMap.observe: ${remoteParams.type}`
					}
					localObj.setOptions(remoteParams)
					localObj.id = key
					canvas.add(localObj)
				}
				localObj.setCoords()
			}
		}
	}
	for (let key of keys) {
		let remoteParams = yDrawingMap.get(key)
		if (key === 'activeSelection') {
			if (remoteParams.members.length > 0) {
				// a selection has been created remotely; make one here
				let selectedObjects = remoteParams.members.map((id) => canvas.getObjects().find((o) => o.id === id))
				let sel = new fabric.ActiveSelection(selectedObjects, {
					canvas: canvas,
				})
				canvas.setActiveObject(sel)
			}
			updateActiveButtons()
		} else {
			if (remoteParams.type === 'group') {
				let objs = remoteParams.members.map((id) => canvas.getObjects().find((o) => o.id === id))
				canvas.discardActiveObject()
				let group = new fabric.Group(objs)
				canvas.remove(...objs)
				group.id = key
				group.members = remoteParams.members
				setGroupBorderColor(group)
				group.set({
					left: remoteParams.left,
					top: remoteParams.top,
					angle: remoteParams.angle,
					scaleX: remoteParams.scaleX,
					scaleY: remoteParams.scaleY,
				})
				canvas.add(group)
				canvas.setActiveObject(group)
			}
		}
	}
	// if there is a white circle, assume that this was from a version 1 pixel eraser
	// and delete objects that it would have covered
	let OldStyleEraser = canvas.getObjects().filter((obj) => obj.type === 'circle' && obj.fill === '#ffffff')
	if (OldStyleEraser.length) magicEraser()
	if (!drawingSwitch) canvas.discardActiveObject()
	canvas.requestRenderAll()
}

/**
 * Draw the background grid before rendering the fabric objects
 */
canvas.on('before:render', () => {
	if (drawingSwitch) drawGrid()
	canvas.clearContext(canvas.contextTop)
})
canvas.on('selection:created', (e) => updateSelection(e))
canvas.on('selection:updated', (e) => updateSelection(e))

/**
 * save changes and update state when user has selected more than 1 object
 * @param {canvasEvent} evt
 */
function updateSelection(evt) {
	// only process updates caused by user (if evt.e is undefined, the update has been generated by remote activity)
	if (evt.e) {
		let activeObject = canvas.getActiveObject()
		let activeMembers = canvas.getActiveObjects()
		// only record selections with more than 1 member object
		if (activeObject.type === 'activeSelection' && activeMembers.length > 1) {
			activeObject.id = 'selection'
			yDrawingMap.set('activeSelection', {
				members: activeMembers.map((o) => o.id),
			})
			saveChange(activeObject, {id: activeObject.id, members: activeMembers.map((o) => o.id)}, 'add')
		}
		if (activeMembers.length > 1) {
			closeOptionsDialogs()
		} else {
			if (evt.selected[0].type !== selectedTool) closeOptionsDialogs()
			// no option possible when selecting path, group or image
			if (!['path', 'group', 'image'].includes(evt.selected[0].type)) evt.selected[0].optionsDialog()
		}
		updateActiveButtons()
	}
}

// save changes and update state when user has unselected all objects
canvas.on('selection:cleared', (evt) => {
	if (!evt.e) return
	yDrawingMap.set('activeSelection', {members: []})
	if (evt.deselected.length > 1) {
		let members = evt.deselected
		saveChange({type: 'selection', id: 'selection'}, {members: members.map((o) => o.id)}, 'discard')
		members.forEach((m) => saveChange(m, {}, 'update'))
	}
	deselectTool()
	// only allow deletion of selected objects
	elem('bin').classList.add('disabled')
	elem('group').classList.add('disabled')
})

// user has just finished creating a path (with pencil or marker) - save it
canvas.on('path:created', () => {
	let obj = getLastPath()
	obj.id = uuidv4()
	saveChange(
		obj,
		{
			path: obj.path,
			stroke: obj.stroke,
			strokeWidth: obj.strokeWidth,
			pathOffset: obj.pathOffset,
			fill: null,
		},
		'insert'
	)
})

// record object moves on undo stack and broadcast them
canvas.on('object:modified', (rec) => {
	let obj = rec.target
	if (!obj.id) obj.id = uuidv4()
	saveChange(obj, {id: obj.id}, 'update')
})

/**
 * draw a grid on the drawing canvas
 * @param {Integer} grid_size - pixels between grid lines
 */
function drawGrid(grid_size = 25) {
	const grid_context = elem('drawing-canvas').getContext('2d')
	const currentCanvasWidth = canvas.getWidth()
	const currentCanvasHeight = canvas.getHeight()

	grid_context.save()
	grid_context.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight)
	// Drawing vertical lines
	for (let x = 0; x <= currentCanvasWidth; x += grid_size) {
		grid_context.moveTo(x + 0.5, 0)
		grid_context.lineTo(x + 0.5, currentCanvasHeight)
	}

	// Drawing horizontal lines
	for (let y = 0; y <= currentCanvasHeight; y += grid_size) {
		grid_context.moveTo(0, y + 0.5)
		grid_context.lineTo(currentCanvasWidth, y + 0.5)
	}
	grid_context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
	grid_context.stroke()
	grid_context.restore()
}
/**
 * add event listeners to the tools to receive user clicks to select a tool
 */
function setUpToolbox() {
	let tools = document.querySelectorAll('.tool')
	Array.from(tools).forEach((tool) => {
		tool.addEventListener('click', selectTool)
	})
	dragElement(elem('toolbox'), elem('toolbox-header'))
}
/**
 *
 * Toolbox
 */

/**
 * When the user clicks a tool icon
 * unselect previous tool, select this one
 * and remember which tool is now selected
 * The undo, redo, delete and image tools are special, because they act
 * immediately when the icon is clicked
 *
 * @param {object} event
 */
function selectTool(event) {
	let tool = event.currentTarget
	if (tool.id === 'undotool') {
		currentObject = null
		toolHandler('undo').undo()
		return
	}
	if (tool.id === 'redotool') {
		currentObject = null
		toolHandler('undo').redo()
		return
	}
	if (tool.id === 'group') {
		currentObject = null
		let activeObj = canvas.getActiveObject()
		if (!activeObj) return
		if (activeObj.type === 'group') unGroup()
		else makeGroup()
		return
	}
	if (tool.id === 'bin') {
		currentObject = null
		toolHandler('bin').delete()
		return
	}
	//second click on selected tool - unselect it
	if (selectedTool === tool.id) {
		deselectTool()
		return
	}
	// changing tool; unselect previous one
	deselectTool()
	selectedTool = tool.id
	tool.classList.add('selected')
	// display options dialog
	toolHandler(selectedTool).optionsDialog()
	canvas.isDrawingMode = tool.id === 'pencil' || tool.id === 'marker'
	// if tool is 'image', get image file from user
	if (tool.id === 'image') {
		let fileInput = document.createElement('input')
		fileInput.id = 'fileInput'
		fileInput.setAttribute('type', 'file')
		fileInput.setAttribute('accept', 'image/*')
		fileInput.addEventListener('change', toolHandler(selectedTool).loadImage)
		fileInput.click()
	}
}

/**
 * unmark the selected tool, unselect the active object,
 * close the option dialog and set tool to null
 */
export function deselectTool() {
	unselectTool()
	canvas.isDrawingMode = false
	canvas.discardActiveObject().requestRenderAll()
	closeOptionsDialogs()
	updateActiveButtons()
}
/**
 * unselect the current tool
 */
function unselectTool() {
	if (selectedTool) {
		elem(selectedTool).classList.remove('selected')
	}
	selectedTool = null
	currentObject = null
}
/**
 * remove any option dialog that is open
 */
function closeOptionsDialogs() {
	let box = elem('optionsBox')
	if (box) box.remove()
}
/**
 * show whether some buttons are active or disabled, depending
 * on whether anything is selected and whether undo or redo is possible
 */
function updateActiveButtons() {
	if (undos.length > 0) elem('undotool').classList.remove('disabled')
	else elem('undotool').classList.add('disabled')
	if (redos.length > 0) elem('redotool').classList.remove('disabled')
	else elem('redotool').classList.add('disabled')
	let nActiveObjects = canvas.getActiveObjects().length
	if (nActiveObjects > 0) elem('bin').classList.remove('disabled')
	else elem('bin').classList.add('disabled')
	if (nActiveObjects > 1) elem('group').classList.remove('disabled')
	else elem('group').classList.add('disabled')
}
/**
 * return the correct instance of toolHandler for the given tool
 * @param {string} tool
 * @returns {object}
 */
function toolHandler(tool) {
	if (currentObject) return currentObject
	switch (tool) {
		case 'rect':
			currentObject = new RectHandler()
			break
		case 'circle':
			currentObject = new CircleHandler()
			break
		case 'line':
			currentObject = new LineHandler()
			break
		case 'text':
			currentObject = new TextHandler()
			break
		case 'pencil':
			currentObject = new PencilHandler()
			break
		case 'marker':
			currentObject = new MarkerHandler()
			break
		case 'image':
			currentObject = new ImageHandler()
			break
		case 'bin':
			currentObject = new DeleteHandler()
			break
		case 'undo':
			currentObject = new UndoHandler()
			break
	}
	return currentObject
}

/**
 * react to key presses and mouse movements
 */
window.addEventListener('keydown', (e) => {
	if ((drawingSwitch && e.key === 'Backspace') || e.key === 'Delete') {
		e.preventDefault()
		currentObject = null
		toolHandler('bin').delete()
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && (e.ctrlKey || e.metaKey) && e.key === 'z') {
		e.preventDefault()
		currentObject = null
		toolHandler('undo').undo()
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && (e.ctrlKey || e.metaKey) && e.key === 'y') {
		e.preventDefault()
		currentObject = null
		toolHandler('undo').redo()
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && e.key === 'ArrowUp') {
		e.preventDefault()
		arrowMove('ArrowUp')
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && e.key === 'ArrowDown') {
		e.preventDefault()
		arrowMove('ArrowDown')
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && e.key === 'ArrowLeft') {
		e.preventDefault()
		arrowMove('ArrowLeft')
	}
})
window.addEventListener('keydown', (e) => {
	if (drawingSwitch && e.key === 'ArrowRight') {
		e.preventDefault()
		arrowMove('ArrowRight')
	}
})
/**
 *  handle mouse moves, despatching to tools or panning the canvas
 */

canvas.on('mouse:down', function (options) {
	let event = options.e
	if (selectedTool) {
		toolHandler(selectedTool)[event.type](event)
	} else {
		if (!canvas.getActiveObject()) {
			this.isDragging = true
			this.selection = false
			this.lastPosX = event.clientX
			this.lastPosY = event.clientY
		}
	}
})

canvas.on('mouse:move', function (options) {
	let event = options.e
	if (selectedTool) {
		toolHandler(selectedTool)[event.type](event)
	} else {
		if (this.isDragging) {
			event.stopImmediatePropagation()
			let vpt = this.viewportTransform
			let moveX = event.clientX - this.lastPosX
			let moveY = event.clientY - this.lastPosY
			vpt[4] += moveX
			vpt[5] += moveY
			let networkVP = network.getViewPosition()
			network.moveTo({
				position: {
					x: networkVP.x - moveX / vpt[0],
					y: networkVP.y - moveY / vpt[0],
				},
			})
			this.requestRenderAll()
			this.lastPosX = event.clientX
			this.lastPosY = event.clientY
		}
	}
})
canvas.on('mouse:up', function (options) {
	let event = options.e
	if (selectedTool) {
		toolHandler(selectedTool)[event.type](event)
	} else {
		this.setViewportTransform(this.viewportTransform)
		this.isDragging = false
		this.selection = true
	}
})
canvas.on('mouse:dblclick', () => fit())

const ARROOWINCR = 1

function arrowMove(direction) {
	let activeObj = canvas.getActiveObject()
	if (!activeObj) return
	let top = activeObj.top
	let left = activeObj.left
	switch (direction) {
		case 'ArrowUp':
			top -= ARROOWINCR
			break
		case 'ArrowDown':
			top += ARROOWINCR
			break
		case 'ArrowLeft':
			left -= ARROOWINCR
			break
		case 'ArrowRight':
			left += ARROOWINCR
			break
	}
	activeObj.set({left: left, top: top})
	canvas.requestRenderAll()
}

/**
 * Create an HTMLElement that will hold the options dialog
 * @param {String} tool
 * @returns HTMLElement
 */
function makeOptionsDialog(tool) {
	if (!tool) return
	let underlay = elem('underlay')
	let box = document.createElement('div')
	box.className = 'options'
	box.id = 'optionsBox'
	box.style.top = `${elem(tool).getBoundingClientRect().top - underlay.getBoundingClientRect().top}px`
	box.style.left = `${elem(tool).getBoundingClientRect().right + 10}px`
	underlay.appendChild(box)
	return box
}

/******************************************************************Rect ********************************************/

let RectHandler = fabric.util.createClass(fabric.Rect, {
	type: 'rect',
	initialize: function () {
		this.callSuper('initialize', {
			fill: '#ffffff',
			strokeWidth: 1,
			stroke: '#000000',
			strokeUniform: true,
		})
		this.dragging = false
		this.roundCorners = 10
		this.id = uuidv4()
		this.strokeUniform = true
	},
	pointerdown: function (e) {
		this.setParams()
		this.dragging = true
		this.start = canvas.getPointer(e)
		this.left = this.start.x
		this.top = this.start.y
		this.width = 0
		this.height = 0
		this.rx = this.roundCorners
		this.ry = this.roundCorners
		canvas.add(this)
		canvas.selection = false
	},
	pointermove: function (e) {
		if (!this.dragging) return
		let pointer = canvas.getPointer(e)
		// allow rect to be drawn from bottom right corner as well as from top left corner
		let left = Math.min(this.start.x, pointer.x)
		let top = Math.min(this.start.y, pointer.y)
		this.set({
			left: left,
			top: top,
			width: Math.abs(this.start.x - pointer.x),
			height: Math.abs(this.start.y - pointer.y),
		})
		canvas.requestRenderAll()
	},
	pointerup: function () {
		this.dragging = false
		currentObject = null
		if (this.width === 0 || this.height === 0) return
		saveChange(
			this,
			{
				rx: this.rx,
				ry: this.ry,
				fill: this.fill,
				strokeWidth: this.strokeWidth,
				stroke: this.stroke,
			},
			'insert'
		)
		canvas.selection = true
		canvas.setActiveObject(this).requestRenderAll()
		unselectTool()
	},
	update: function () {
		this.setParams()
		saveChange(
			this,
			{
				rx: this.rx,
				ry: this.ry,
				fill: this.fill,
				strokeWidth: this.strokeWidth,
				stroke: this.stroke,
			},
			'update'
		)
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		let rounded = elem('rounded').checked ? 10 : 0
		let fill = elem('fillColor').style.backgroundColor
		// make white transparent
		if (fill === 'rgb(255, 255, 255)') fill = 'rgba(0, 0, 0, 0)'
		this.set({
			rx: rounded,
			ry: rounded,
			fill: fill,
			strokeWidth: parseInt(elem('borderWidth').value),
			stroke: elem('borderColor').style.backgroundColor,
		})
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (elem('optionsBox')) return
		this.box = makeOptionsDialog('rect')
		this.box.innerHTML = `
	<div>Border width</div><div><input id="borderWidth"  type="number" min="0" max="99" size="2"></div>
	<div>Border Colour</div><div class="input-color-container">
		<div class="color-well" id="borderColor"></div>
	</div>	
  	<div>Fill Colour</div><div class="input-color-container">
  		<div class="color-well" id="fillColor"></div>
	</div>
	<div>Rounded</div><input type="checkbox" id="rounded"></div>`
		cp.createColorPicker(
			'fillColor',
			() => this.update(),
			() => this.setParams()
		)
		cp.createColorPicker(
			'borderColor',
			() => this.update(),
			() => this.setParams()
		)
		let widthInput = elem('borderWidth')
		widthInput.value = this.strokeWidth
		widthInput.addEventListener('change', () => {
			this.update()
		})
		let borderColor = elem('borderColor')
		borderColor.style.backgroundColor = this.stroke
		let fillColor = elem('fillColor')
		fillColor.style.backgroundColor = this.fill
		let rounded = elem('rounded')
		rounded.checked = this.roundCorners !== 0
		rounded.addEventListener('change', () => {
			this.update()
		})
	},
})
/******************************************************************Circle ********************************************/

let CircleHandler = fabric.util.createClass(fabric.Circle, {
	type: 'circle',
	initialize: function () {
		this.callSuper('initialize', {
			fill: '#ffffff',
			strokeWidth: 1,
			stroke: '#000000',
			strokeUniform: true,
		})
		this.dragging = false
		this.id = uuidv4()
		this.originX = 'left'
		this.originY = 'top'
	},
	pointerdown: function (e) {
		this.setParams()
		this.dragging = true
		this.start = canvas.getPointer(e)
		this.left = this.start.x
		this.top = this.start.y
		this.radius = 0
		canvas.add(this)
		canvas.selection = false
	},
	pointermove: function (e) {
		if (!this.dragging) return
		let pointer = canvas.getPointer(e)
		// allow drawing from bottom right corner as well as from top left corner
		let left = Math.min(this.start.x, pointer.x)
		let top = Math.min(this.start.y, pointer.y)
		this.set({
			left: left,
			top: top,
			radius: Math.sqrt((this.start.x - pointer.x) ** 2 + (this.start.y - pointer.y) ** 2) / 2,
		})
		canvas.requestRenderAll()
	},
	pointerup: function () {
		this.dragging = false
		currentObject = null
		if (this.radius === 0) return
		saveChange(this, {fill: this.fill, strokeWidth: this.strokeWidth, stroke: this.stroke}, 'insert')
		canvas.selection = true
		canvas.setActiveObject(this).requestRenderAll()
		unselectTool()
	},
	update: function () {
		this.setParams()
		saveChange(this, {fill: this.fill, strokeWidth: this.strokeWidth, stroke: this.stroke}, 'update')
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		let fill = elem('fillColor').style.backgroundColor
		// make white transparent
		if (fill === 'rgb(255, 255, 255)') fill = 'rgba(0, 0, 0, 0)'
		this.set({
			fill: fill,
			strokeWidth: parseInt(elem('borderWidth').value),
			stroke: elem('borderColor').style.backgroundColor,
		})
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (elem('optionsBox')) return
		this.box = makeOptionsDialog('circle')
		this.box.innerHTML = `
	<div>Border width</div><div><input id="borderWidth"  type="number" min="0" max="99" size="2"></div>
	<div>Border Colour</div><div class="input-color-container">
		<div class="color-well" id="borderColor"></div>
	</div>	
  	<div>Fill Colour</div><div class="input-color-container">
  		<div class="color-well" id="fillColor"></div>
	</div>`
		cp.createColorPicker(
			'fillColor',
			() => this.update(),
			() => this.setParams()
		)
		cp.createColorPicker(
			'borderColor',
			() => this.update(),
			() => this.setParams()
		)
		let widthInput = elem('borderWidth')
		widthInput.value = this.strokeWidth
		widthInput.addEventListener('change', () => {
			this.update()
		})
		let borderColor = elem('borderColor')
		borderColor.style.backgroundColor = this.stroke
		let fillColor = elem('fillColor')
		fillColor.style.backgroundColor = this.fill
	},
})
/******************************************************************Line ********************************************/
let LineHandler = fabric.util.createClass(fabric.Line, {
	type: 'line',
	initialize: function () {
		this.callSuper('initialize', {
			strokeWidth: 1,
			stroke: '#000000',
			strokeUniform: true,
		})
		this.dragging = false
		this.axes = false
		this.dashed = false
		this.id = uuidv4()
		this.stroke = '#000000'
		this.strokeWidth = 2
		this.strokeUniform = true
	},
	pointerdown: function (e) {
		this.setParams()
		this.dragging = true
		canvas.selection = false
		this.start = canvas.getPointer(e)
		this.set({
			x1: this.start.x,
			y1: this.start.y,
			x2: this.start.x,
			y2: this.start.y,
		})
		canvas.add(this)
	},
	pointermove: function (e) {
		if (!this.dragging) return
		let endPoint = canvas.getPointer(e)
		let x2 = endPoint.x
		let y2 = endPoint.y
		let x1 = this.start.x
		let y1 = this.start.y
		if (this.axes) {
			if (x2 - x1 > y2 - y1) y2 = y1
			else x2 = x1
		}
		this.set({x1: x1, y1: y1, x2: x2, y2: y2})
		canvas.requestRenderAll()
	},
	pointerup: function () {
		this.dragging = false
		currentObject = null
		if (this.x1 === this.x2 && this.y1 === this.y2) return
		saveChange(
			this,
			{
				axes: this.axes,
				strokeWidth: this.strokeWidth,
				stroke: this.stroke,
				strokeDashArray: this.strokeDashArray,
			},
			'insert'
		)
		canvas.selection = true
		canvas.setActiveObject(this).requestRenderAll()
		unselectTool()
	},
	update: function () {
		this.setParams()
		saveChange(
			this,
			{
				axes: this.axes,
				strokeWidth: this.strokeWidth,
				stroke: this.stroke,
				strokeDashArray: this.strokeDashArray,
			},
			'update'
		)
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		this.axes = elem('axes').checked
		if (this.axes) {
			if (this.x2 - this.x1 > this.y2 - this.y1) this.y2 = this.y1
			else this.x2 = this.x1
			this.set({x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2})
		}
		// if line is constrained to horizontal/vertical (axes is true),
		// don't display a rotate control point
		this.setControlsVisibility({
			mtr: !this.axes,
			bl: false,
			br: true,
			mb: false,
			ml: false,
			mr: false,
			mt: false,
			tl: true,
			tr: false,
		})
		this.set({
			strokeWidth: parseInt(elem('lineWidth').value),
			stroke: elem('lineColor').style.backgroundColor,
			strokeDashArray: elem('dashed').checked ? [10, 10] : null,
		})
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (elem('optionsBox')) return
		this.box = makeOptionsDialog('line')
		this.box.innerHTML = `
	<div>Line width</div><div><input id="lineWidth" type="number" min="0" max="99" size="1"></div>
	<div>Colour</div><div class="input-color-container">
		<div class="color-well" id="lineColor"></div>
	</div>
	<div>Dashed</div><div><input type="checkbox" id="dashed"></div>
	<div>Vert/Horiz</div><div><input type="checkbox" id="axes"></div>`
		cp.createColorPicker(
			'lineColor',
			() => this.update(),
			() => this.setParams()
		)
		let widthInput = elem('lineWidth')
		widthInput.value = this.strokeWidth
		widthInput.addEventListener('change', () => {
			this.update()
		})
		let lineColor = elem('lineColor')
		lineColor.style.backgroundColor = this.stroke
		let dashed = elem('dashed')
		dashed.checked = this.strokeDashArray
		dashed.addEventListener('change', () => {
			this.update()
		})
		let axes = elem('axes')
		axes.checked = this.axes
		this.setControlsVisibility(this.axes)
		axes.addEventListener('change', () => {
			this.update()
		})
	},
})

/******************************************************************Text ********************************************/

let TextHandler = fabric.util.createClass(fabric.IText, {
	type: 'text',
	initialize: function () {
		this.callSuper('initialize', 'Text', {
			fontSize: 32,
			fill: '#000000',
			fontFamily: 'Oxygen',
		})
		this.id = uuidv4()
	},
	pointerdown: function (e) {
		this.setParams()
		this.start = canvas.getPointer(e)
		this.left = this.start.x
		this.top = this.start.y
		this.fontFamily = 'Oxygen'
		canvas.add(this)
		canvas.setActiveObject(this).requestRenderAll()
		unselectTool()
		this.enterEditing()
		this.selectAll()
		this.on('editing:exited', () => {
			saveChange(
				this,
				{
					fontSize: this.fontSize,
					fill: this.fill,
					fontFamily: 'Oxygen',
					text: this.text,
				},
				'insert'
			)
		})
	},
	pointermove: function () {
		return
	},
	pointerup: function () {
		return
	},
	update: function () {
		this.setParams()
		saveChange(this, {fontSize: this.fontSize, fill: this.fill, text: this.text}, 'update')
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		this.set({
			fontSize: parseInt(elem('fontSize').value),
			fill: elem('fontColor').style.backgroundColor,
		})
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (!elem('optionsBox')) {
			this.box = makeOptionsDialog('text')
			this.box.innerHTML = `
	<div>Size</div><div><input id="fontSize"  type="number" min="0" max="99" size="2"></div>
	<div>Colour</div><div class="input-color-container">
		<div class="color-well" id="fontColor"></div>
	</div>`
			cp.createColorPicker(
				'fontColor',
				() => this.update(),
				() => this.setParams()
			)
		}
		let fontSizeInput = elem('fontSize')
		fontSizeInput.value = parseInt(this.fontSize)
		fontSizeInput.addEventListener('change', () => {
			this.update()
		})
		let fontColor = elem('fontColor')
		fontColor.style.backgroundColor = this.fill
	},
})

/******************************************************************Pencil ********************************************/

let PencilHandler = fabric.util.createClass(fabric.Object, {
	type: 'pencil',
	initialize: function () {
		this.callSuper('initialize', {width: 1, color: '#000000'})
		canvas.freeDrawingBrush.width = 1
		canvas.freeDrawingBrush.color = '#000000'
	},
	pointerdown: function () {
		this.setParams()
	},
	pointermove: function () {},
	pointerup: function () {},
	update: function () {
		this.setParams()
		let pathObj = getLastPath()
		saveChange(pathObj, {path: pathObj.path}, 'update')
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		this.width = parseInt(elem('pencilWidth').value)
		this.color = elem('pencilColor').style.backgroundColor
		canvas.freeDrawingBrush.width = this.width
		canvas.freeDrawingBrush.color = this.color
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (!elem('optionsBox')) {
			this.box = makeOptionsDialog('pencil')
			this.box.innerHTML = `
		<div>Width</div><div><input id="pencilWidth"  type="number" min="0" max="99" size="2"></div>
		<div>Colour</div><div class="input-color-container">
			<div class="color-well" id="pencilColor"></div>
		</div>`
			cp.createColorPicker(
				'pencilColor',
				() => this.update(),
				() => this.setParams()
			)
		}
		let widthInput = document.getElementById('pencilWidth')
		widthInput.value = this.width
		widthInput.addEventListener('change', () => {
			this.update()
		})
		let pencilColor = document.getElementById('pencilColor')
		pencilColor.style.backgroundColor = this.color
	},
})

/******************************************************************Marker ********************************************/

let MarkerHandler = fabric.util.createClass(fabric.Object, {
	type: 'marker',
	initialize: function () {
		this.callSuper('initialize', {
			width: 30,
			color: 'rgb(249, 255, 71)',
			strokeLineCap: 'square',
			strokeLineJoin: 'bevel',
		})
		canvas.freeDrawingBrush.width = 30
		canvas.freeDrawingBrush.color = 'rgb(249, 255, 71)'
	},
	pointerdown: function () {
		this.setParams()
	},
	pointermove: function () {},
	pointerup: function () {},
	update: function () {
		this.setParams()
		saveChange(getLastPath(), {}, 'update')
	},
	setParams: function () {
		if (!elem('optionsBox')) return
		this.width = parseInt(elem('pencilWidth').value)
		this.color = elem('pencilColor').style.backgroundColor
		canvas.freeDrawingBrush.width = this.width
		canvas.freeDrawingBrush.color = this.color
		canvas.requestRenderAll()
	},
	optionsDialog: function () {
		if (!elem('optionsBox')) {
			this.box = makeOptionsDialog('marker')
			this.box.innerHTML = `		
			<div>Width</div><div><input id="pencilWidth"  type="number" min="0" max="99" size="2"></div>
			<div>Colour</div><div class="input-color-container">
			<div class="color-well" id="pencilColor"></div>
		</div>`
			cp.createColorPicker(
				'pencilColor',
				() => this.update(),
				() => this.setParams()
			)
		}
		let widthInput = document.getElementById('pencilWidth')
		widthInput.value = this.width
		widthInput.addEventListener('change', () => {
			this.update()
		})
		let pencilColor = document.getElementById('pencilColor')
		pencilColor.style.backgroundColor = this.color
	},
})

/**
 * called after a pencil or marker has been used to retrieve the path object that it created
 * @returns fabric path object
 */
function getLastPath() {
	let objs = canvas.getObjects()
	let path = objs[objs.length - 1]
	if (!path || path.type !== 'path') throw 'Last path is not a path'
	return path
}
/******************************************************************Image ********************************************/

let ImageHandler = fabric.util.createClass(fabric.Object, {
	type: 'image',
	initialize: function () {
		this.callSuper('initialize', {})
	},
	loadImage: function (e) {
		if (e.target.files) {
			let file = e.target.files[0]
			let reader = new FileReader()
			reader.readAsDataURL(file)

			reader.onloadend = function (e) {
				let image = new Image()
				image.src = e.target.result
				image.onload = function (e) {
					let imageElement = e.target
					// display image centred on viewport with max dimensions 300 x 300
					if (imageElement.width > imageElement.height) {
						if (imageElement.width > 300) imageElement.width = 300
					} else {
						if (imageElement.height > 300) imageElement.height = 300
					}
					this.imageInstance = new fabric.Image(imageElement)
					this.imageInstance.set({originX: 'center', originY: 'center'})
					this.imageInstance.viewportCenter()
					this.imageInstance.setCoords()
					this.imageInstance.id = uuidv4()
					canvas.add(this.imageInstance)
					saveChange(this.imageInstance, {}, 'insert')
					unselectTool()
					canvas.setActiveObject(this.imageInstance).requestRenderAll()
				}
			}
		}
	},
	pointerdown: function () {},
	pointermove: function () {},
	pointerup: function () {},
	update: function () {},
	optionsDialog: function () {},
})
/****************************************************************** Group ********************************************/

function makeGroup() {
	let activeObj = canvas.getActiveObject()
	if (!activeObj || activeObj.type !== 'activeSelection') return
	let group = activeObj.toGroup()
	group.id = uuidv4()
	group.members = group.getObjects().map((ob) => ob.id)
	group.type = 'group'
	setGroupBorderColor(group)
	saveChange(group, {members: group.members}, 'insert')
	canvas.requestRenderAll()
	elem('group').classList.remove('disabled')
	statusMsg('Grouped', 'info')
}

function unGroup() {
	let activeObj = canvas.getActiveObject()
	if (!activeObj || activeObj.type !== 'group') return
	let members = activeObj.getObjects()
	activeObj.toActiveSelection()
	saveChange(activeObj, {type: 'ungroup', members: members.map((ob) => ob.id)}, 'delete')
	canvas.discardActiveObject()
	canvas.requestRenderAll()
	statusMsg('Ungrouped', 'info')
}
function setGroupBorderColor(group) {
	group.borderColor = 'green'
	group.cornerColor = 'green'
}
/****************************************************************** Bin (delete) ********************************************/

let DeleteHandler = fabric.util.createClass(fabric.Object, {
	type: 'bin',
	initialize: function () {
		this.callSuper('initialize', {})
	},
	delete: function () {
		deleteActiveObjects()
		unselectTool()
	},
	pointerdown: function () {},
	pointermove: function () {},
	pointerup: function () {},
	optionsDialog: function () {},
})
/**
 * catch and branch to a handler for special Key commands
 * Delete, ^z (undo) and ^y (redo)
 * @param {event} e
 */
function checkKey(e) {
	//e.preventDefault()
	if (e.keyCode === 46 || e.key === 'Delete' || e.code === 'Delete' || e.key === 'Backspace') {
		deleteActiveObjects()
	}
	if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
		currentObject = null
		toolHandler('undo').undo()
	}
	if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
		currentObject = null
		toolHandler('undo').redo()
	}
}
/**
 * makes the active object invisible (unless it is a group, which is actually deleted)
 * this allows 'undo' to re-instate the object, by making it visible
 */
function deleteActiveObjects() {
	canvas.getActiveObjects().forEach((obj) => {
		if (obj.isEditing) return
		if (obj.group) canvas.remove(obj.group)
		obj.set('visible', false)
		saveChange(obj, {visible: false}, 'delete')
	})
	canvas.discardActiveObject().requestRenderAll()
}

/******************************************************************Undo ********************************************/

let UndoHandler = fabric.util.createClass(fabric.Object, {
	type: 'undo',
	initialize: function () {
		this.callSuper('initialize', {})
	},
	undo: function () {
		if (undos.length === 0) return // nothing on the undo stack
		let undo = undos.pop()
		yDrawingMap.set('undos', undos)
		if (undos.length === 0) {
			elem('undotool').classList.add('disabled')
		}
		if (undo.id === 'selection') {
			redos.push(deepCopy(undo))
			yDrawingMap.set('redos', redos)
			elem('redotool').classList.remove('disabled')
			switch (undo.op) {
				case 'add':
					// reverse of add selection is dispose of it
					canvas.discardActiveObject()
					elem('bin').classList.add('disabled')
					elem('group').classList.add('disabled')
					break
				case 'update':
					{
						let prevSelParams = undos.findLast((d) => d.id === 'selection').params
						canvas.getActiveObject().set({
							angle: prevSelParams.angle,
							left: prevSelParams.left,
							scaleX: prevSelParams.scaleX,
							scaleY: prevSelParams.scaleY,
							top: prevSelParams.top,
						})
					}
					break
				case 'discard':
					{
						// reverse of discard selection is add it
						let selectedObjects = undo.params.members.map((id) =>
							canvas.getObjects().find((o) => o.id === id)
						)
						let sel = new fabric.ActiveSelection(selectedObjects, {
							canvas: canvas,
						})
						canvas.setActiveObject(sel)
						elem('bin').classList.remove('disabled')
						elem('group').classList.remove('disabled')
					}
					break
			}
			canvas.requestRenderAll()
			return
		}
		if (undo.params.type === 'group' || undo.params.type === 'ungroup') {
			redos.push(deepCopy(undo))
			yDrawingMap.set('redos', redos)
			elem('redotool').classList.remove('disabled')
			let obj = canvas.getObjects().filter((o) => o.id === undo.id)[0]
			switch (undo.op) {
				case 'insert':
					{
						// reverse of add group is dispose of it
						let members = obj.getObjects()
						obj.toActiveSelection()
						saveChange(obj, {type: 'ungroup', members: members.map((ob) => ob.id)}, null)
						canvas.discardActiveObject()
						elem('bin').classList.add('disabled')
						elem('group').classList.add('disabled')
					}
					break
				case 'update':
					{
						// find the previous param set for this group, and set the object to those params
						let prevDelta = undos.findLast((d) => d.id === undo.id)
						obj.setOptions(prevDelta.params)
						obj.setCoords()
						saveChange(obj, prevDelta.params, null)
					}
					break
				case 'delete':
					{
						// reverse of delete group is add it
						let members = undo.params.members.map((id) => canvas.getObjects().find((o) => o.id === id))
						canvas.discardActiveObject()
						let group = new fabric.Group(members)
						canvas.remove(...members)
						group.id = undo.id
						setGroupBorderColor(group)
						saveChange(group, {members: group.getObjects().map((ob) => ob.id), type: 'group'}, null)
						canvas.add(group)
						canvas.setActiveObject(group)
						elem('bin').classList.remove('disabled')
						elem('group').classList.remove('disabled')
					}
					break
			}
			canvas.requestRenderAll()
			return
		}
		// find the object to be undone from its id
		let obj = canvas.getObjects().find((o) => o.id === undo.id)
		// get the current state of the object, so that redo can return it to this state
		let newParams = {}
		for (const prop in undo.params) {
			newParams[prop] = obj[prop]
		}
		redos.push({id: undo.id, params: newParams, op: undo.op})
		yDrawingMap.set('redos', redos)
		elem('redotool').classList.remove('disabled')
		switch (undo.op) {
			case 'insert':
				obj.set('visible', false)
				saveChange(obj, {visible: false}, null)
				break
			case 'delete':
				obj.set('visible', true)
				saveChange(obj, {visible: true}, null)
				break
			case 'update':
				{
					// find the previous param set for this object, and set the object to those params
					let prevDelta = undos.findLast((d) => d.id === obj.id)
					obj.set('visible', true)
					obj.setOptions(prevDelta.params)
					obj.setCoords()
					saveChange(obj, Object.assign(prevDelta.params, {visible: true}), null)
				}
				break
		}
		canvas.discardActiveObject().requestRenderAll()
	},
	redo: function () {
		if (redos.length === 0) return
		let redo = redos.pop()
		yDrawingMap.set('redos', redos)
		if (redos.length === 0) {
			elem('redotool').classList.add('disabled')
		}
		if (redo.id === 'selection') {
			undos.push(deepCopy(redo))
			yDrawingMap.set('undos', undos)
			elem('undotool').classList.remove('disabled')
			switch (redo.op) {
				case 'add':
					{
						let selectedObjects = redo.params.members.map((id) =>
							canvas.getObjects().find((o) => o.id === id)
						)
						let sel = new fabric.ActiveSelection(selectedObjects, {
							canvas: canvas,
						})
						canvas.setActiveObject(sel)
						elem('bin').classList.remove('disabled')
						elem('group').classList.remove('disabled')
					}
					break
				case 'update':
					canvas.getActiveObject().set({
						angle: redo.params.angle,
						left: redo.params.left,
						scaleX: redo.params.scaleX,
						scaleY: redo.params.scaleY,
						top: redo.params.top,
					})
					break
				case 'discard':
					canvas.discardActiveObject()
					elem('bin').classList.add('disabled')
					elem('group').classList.add('disabled')
					break
			}
			canvas.requestRenderAll()
			return
		}
		if (redo.params.type === 'group' || redo.params.type === 'ungroup') {
			undos.push(deepCopy(redo))
			yDrawingMap.set('undos', undos)
			elem('undotool').classList.remove('disabled')
			let obj = canvas.getObjects().filter((o) => o.id === redo.id)[0]
			switch (redo.op) {
				case 'delete':
					{
						// reverse of add group is dispose of it
						let members = obj.getObjects()
						obj.toActiveSelection()
						saveChange(obj, {type: 'ungroup', members: members.map((ob) => ob.id)}, null)
						canvas.discardActiveObject()
						elem('bin').classList.add('disabled')
						elem('group').classList.add('disabled')
					}
					break
				case 'update':
					{
						// find the previous param set for this group, and set the object to those params
						let prevDelta = undos.findLast((d) => d.id === redo.id)
						obj.setOptions(prevDelta.params)
						obj.setCoords()
						saveChange(obj, prevDelta.params, null)
					}
					break
				case 'insert':
					{
						// reverse of delete group is add it
						let members = redo.params.members.map((id) => canvas.getObjects().find((o) => o.id === id))
						canvas.discardActiveObject()
						let group = new fabric.Group(members)
						canvas.remove(...members)
						group.id = redo.id
						setGroupBorderColor(group)
						saveChange(group, {members: group.getObjects().map((ob) => ob.id), type: 'group'}, null)
						canvas.add(group)
						canvas.setActiveObject(group)
						elem('bin').classList.remove('disabled')
						elem('group').classList.remove('disabled')
					}
					break
			}
			canvas.requestRenderAll()
			return
		}
		let obj = canvas.getObjects().find((o) => o.id === redo.id)
		let newParams = {}
		for (const prop in redo.params) {
			newParams[prop] = obj[prop]
		}
		undos.push({id: redo.id, params: newParams, op: redo.op})
		yDrawingMap.set('undos', undos)
		elem('undotool').classList.remove('disabled')
		switch (redo.op) {
			case 'insert':
				obj.set('visible', true)
				saveChange(obj, {visible: true}, null)
				break
			case 'delete':
				obj.set('visible', false)
				saveChange(obj, {visible: false}, null)
				break
			case 'update':
				obj.setOptions(redo.params)
				obj.setCoords()
				saveChange(obj, Object.assign(redo.params, {visible: true}), null)
				break
		}
		canvas.discardActiveObject().requestRenderAll()
	},
})
/****************************************************************** Broadcast ********************************************/

/**
 * Broadcast the changes to other clients and
 * save the current state of the object on the undo stack
 * @param {String} obj the object
 * @param {Object} params the current state
 * @param {String} op insert|delete|update|null (if null, don't save on the undo stack)
 */
function saveChange(obj, params = {}, op) {
	// save current object position as well as any format changes
	params = setParams(obj, params)
	// send the object to other clients
	yDrawingMap.set(obj.id, params)
	// save the change on the undo stack
	if (op) {
		undos.push({op: op, id: obj.id, params: params})
		yDrawingMap.set('undos', undos)
		elem('undotool').classList.remove('disabled')
	}
}
/**
 * Collect the parameters that would allow the reproduction of the object
 * @param {object} obj - fabric object
 * @param {object} params - initial parameters
 * @returns params
 */
function setParams(obj, params) {
	if (obj.cacheProperties) obj.cacheProperties.forEach((p) => (params[p] = obj[p]))
	params.left = params.left || obj.left
	params.top = params.top || obj.top
	params.angle = obj.angle
	params.scaleX = obj.scaleX
	params.scaleY = obj.scaleY
	params.type = params.type || obj.type
	if (obj.type === 'path') params.pathOffset = obj.pathOffset
	if (obj.type === 'image') params.imageObj = obj.toObject()
	if (obj.type === 'group') params.members = obj.members
	return params
}
/****************************************************************** Smart Guides ********************************************/

const aligningLineOffset = 5
const aligningLineMargin = 4
const aligningLineWidth = 1
const aligningLineColor = 'rgb(255,0,0)'
const aligningDash = [5, 5]

function initAligningGuidelines() {
	let ctx = canvas.getSelectionContext()
	let viewportTransform
	let zoom = 1
	let verticalLines = []
	let horizontalLines = []

	canvas.on('mouse:down', function () {
		viewportTransform = canvas.viewportTransform
		zoom = canvas.getZoom()
	})

	canvas.on('object:moving', function (e) {
		if (!canvas._currentTransform) return
		let activeObject = e.target
		let activeObjectCenter = activeObject.getCenterPoint()
		let activeObjectBoundingRect = activeObject.getBoundingRect()
		let activeObjectHalfHeight = activeObjectBoundingRect.height / (2 * viewportTransform[3])
		let activeObjectHalfWidth = activeObjectBoundingRect.width / (2 * viewportTransform[0])

		canvas
			.getObjects()
			.filter((object) => object !== activeObject && object.visible)
			.forEach((object) => {
				let objectCenter = object.getCenterPoint()
				let objectBoundingRect = object.getBoundingRect()
				let objectHalfHeight = objectBoundingRect.height / (2 * viewportTransform[3])
				let objectHalfWidth = objectBoundingRect.width / (2 * viewportTransform[0])

				// snap by the horizontal center line
				snapVertical(objectCenter.x, activeObjectCenter.x, objectCenter.x)
				// snap by the left object edge matching left active edge
				snapVertical(
					objectCenter.x - objectHalfWidth,
					activeObjectCenter.x - activeObjectHalfWidth,
					objectCenter.x - objectHalfWidth + activeObjectHalfWidth
				)
				// snap by the left object edge matching right active edge
				snapVertical(
					objectCenter.x - objectHalfWidth,
					activeObjectCenter.x + activeObjectHalfWidth,
					objectCenter.x - objectHalfWidth - activeObjectHalfWidth
				)
				// snap by the right object edge matching right active edge
				snapVertical(
					objectCenter.x + objectHalfWidth,
					activeObjectCenter.x + activeObjectHalfWidth,
					objectCenter.x + objectHalfWidth - activeObjectHalfWidth
				)
				// snap by the right object edge matching left active edge
				snapVertical(
					objectCenter.x + objectHalfWidth,
					activeObjectCenter.x - activeObjectHalfWidth,
					objectCenter.x + objectHalfWidth + activeObjectHalfWidth
				)

				function snapVertical(objEdge, activeEdge, snapCenter) {
					if (isInRange(objEdge, activeEdge)) {
						verticalLines.push({
							x: objEdge,
							y1:
								objectCenter.y < activeObjectCenter.y
									? objectCenter.y - objectHalfHeight - aligningLineOffset
									: objectCenter.y + objectHalfHeight + aligningLineOffset,
							y2:
								activeObjectCenter.y > objectCenter.y
									? activeObjectCenter.y + activeObjectHalfHeight + aligningLineOffset
									: activeObjectCenter.y - activeObjectHalfHeight - aligningLineOffset,
						})
						activeObject.setPositionByOrigin(
							new fabric.Point(snapCenter, activeObjectCenter.y),
							'center',
							'center'
						)
					}
				}

				// snap by the vertical center line
				snapHorizontal(objectCenter.y, activeObjectCenter.y, objectCenter.y)
				// snap by the top object edge matching the top active edge
				snapHorizontal(
					objectCenter.y - objectHalfHeight,
					activeObjectCenter.y - activeObjectHalfHeight,
					objectCenter.y - objectHalfHeight + activeObjectHalfHeight
				)
				// snap by the top object edge matching the bottom active edge
				snapHorizontal(
					objectCenter.y - objectHalfHeight,
					activeObjectCenter.y + activeObjectHalfHeight,
					objectCenter.y - objectHalfHeight - activeObjectHalfHeight
				)
				// snap by the bottom object edge matching the bottom active edge
				snapHorizontal(
					objectCenter.y + objectHalfHeight,
					activeObjectCenter.y + activeObjectHalfHeight,
					objectCenter.y + objectHalfHeight - activeObjectHalfHeight
				)
				// snap by the bottom object edge matching the top active edge
				snapHorizontal(
					objectCenter.y + objectHalfHeight,
					activeObjectCenter.y - activeObjectHalfHeight,
					objectCenter.y + objectHalfHeight + activeObjectHalfHeight
				)
				function snapHorizontal(objEdge, activeObjEdge, snapCenter) {
					if (isInRange(objEdge, activeObjEdge)) {
						horizontalLines.push({
							y: objEdge,
							x1:
								objectCenter.x < activeObjectCenter.x
									? objectCenter.x - objectHalfWidth - aligningLineOffset
									: objectCenter.x + objectHalfWidth + aligningLineOffset,
							x2:
								activeObjectCenter.x > objectCenter.x
									? activeObjectCenter.x + activeObjectHalfWidth + aligningLineOffset
									: activeObjectCenter.x - activeObjectHalfWidth - aligningLineOffset,
						})
						activeObject.setPositionByOrigin(
							new fabric.Point(activeObjectCenter.x, snapCenter),
							'center',
							'center'
						)
					}
				}
			})
	})

	canvas.on('after:render', function () {
		verticalLines.forEach((line) => drawVerticalLine(line))
		horizontalLines.forEach((line) => drawHorizontalLine(line))

		verticalLines = []
		horizontalLines = []
	})

	canvas.on('mouse:up', function () {
		canvas.requestRenderAll()
	})

	function drawVerticalLine(coords) {
		drawLine(
			coords.x + 0.5,
			coords.y1 > coords.y2 ? coords.y2 : coords.y1,
			coords.x + 0.5,
			coords.y2 > coords.y1 ? coords.y2 : coords.y1
		)
	}
	function drawHorizontalLine(coords) {
		drawLine(
			coords.x1 > coords.x2 ? coords.x2 : coords.x1,
			coords.y + 0.5,
			coords.x2 > coords.x1 ? coords.x2 : coords.x1,
			coords.y + 0.5
		)
	}
	function drawLine(x1, y1, x2, y2) {
		ctx.save()
		ctx.lineWidth = aligningLineWidth
		ctx.strokeStyle = aligningLineColor
		ctx.setLineDash(aligningDash)
		ctx.beginPath()
		ctx.moveTo(x1 * zoom + viewportTransform[4], y1 * zoom + viewportTransform[5])
		ctx.lineTo(x2 * zoom + viewportTransform[4], y2 * zoom + viewportTransform[5])
		ctx.stroke()
		ctx.restore()
	}
	/**
	 * return true if value2 is within value1 +/- aligningLineMargin
	 * @param {number} value1
	 * @param {number} value2
	 * @returns Boolean
	 */
	function isInRange(value1, value2) {
		return value2 > value1 - aligningLineMargin && value2 < value1 + aligningLineMargin
	}
}

/*************************************copy & paste ********************************************/
var displacement = 0
/**
 * Copy the selected nodes and links to the clipboard
 * NB this doesn't yet work in Firefox, as they haven't implemented the Clipboard API and Permissions yet.
 * @param {Event} event
 */
export function copyBackgroundToClipboard(event) {
	if (document.getSelection().toString()) return // only copy factors if there is no text selected (e.g. in Notes)
	let activeObjs = canvas.getActiveObjects()
	if (activeObjs.length === 0) return
	event.preventDefault()
	let group = canvas.getActiveObject()
	let groupLeft = 0
	let groupTop = 0
	// if the active Object is a group, then the component object positions are relative to the
	// group top, left, not to the canvas.  Compensate for this
	if (group.type === 'activeSelection' || group.type === 'group') {
		groupTop = group.top + group.height / 2
		groupLeft = group.left + group.width / 2
	}
	copyText(
		JSON.stringify(activeObjs.map((obj) => setParams(obj, {left: obj.left + groupLeft, top: obj.top + groupTop})))
	)
	displacement = 0
}

async function copyText(text) {
	try {
		if (typeof navigator.clipboard.writeText !== 'function')
			throw new Error('navigator.clipboard.writeText not a function')
	} catch (e) {
		statusMsg('Copying not implemented in this browser', 'error')
		return false
	}
	try {
		await navigator.clipboard.writeText(text)
		statusMsg('Copied', 'info')
		return true
	} catch (err) {
		console.error('Failed to copy: ', err)
		statusMsg('Copy failed', 'error')
		return false
	}
}

export async function pasteBackgroundFromClipboard() {
	let clip = await getClipboardContents()
	let paramsArray = JSON.parse(clip)
	canvas.discardActiveObject()
	displacement += 10
	for (let params of paramsArray) {
		let copiedObj
		switch (params.type) {
			case 'rect':
				copiedObj = new RectHandler()
				break
			case 'circle':
				copiedObj = new CircleHandler()
				break
			case 'line':
				copiedObj = new LineHandler()
				break
			case 'text':
				copiedObj = new TextHandler()
				break
			case 'path':
				copiedObj = new fabric.Path()
				break
			case 'image':
				fabric.Image.fromObject(params.imageObj, (image) => {
					image.set({
						left: params.left + displacement,
						top: params.top + displacement,
						id: uuidv4(),
					})
					canvas.add(image)
					canvas.setActiveObject(image)
					saveChange(image, {imageObj: image.toObject()}, 'insert')
				})
				continue
			default:
				throw `bad fabric object type in pasteFromClipboard: ${params.type}`
		}
		copiedObj.setOptions(params)
		copiedObj.left += displacement
		copiedObj.top += displacement
		copiedObj.id = uuidv4()
		canvas.add(copiedObj)
		canvas.setActiveObject(copiedObj)
		saveChange(copiedObj, {}, 'insert')
	}
	statusMsg('Pasted', 'info')
}

async function getClipboardContents() {
	try {
		if (typeof navigator.clipboard.readText !== 'function')
			throw new Error('navigator.clipboard.readText not a function')
	} catch (e) {
		statusMsg('Pasting not implemented in this browser', 'error')
		return null
	}
	try {
		return await navigator.clipboard.readText()
	} catch (err) {
		console.error('Failed to read clipboard contents: ', err)
		statusMsg('Failed to paste', 'error')
		return null
	}
}
/**
 * Convert v1 drawing instructions into equivalent v2 background objects
 * @param {array} pointsArray  version 1 background drawing instructions
 */
export function upgradeFromV1(pointsArray) {
	if (yPointsArray.get(0)[1]?.converted) return
	let options
	let ids = []
	canvas.setViewportTransform([1, 0, 0, 1, canvas.getWidth() / 2, canvas.getHeight() / 2])
	markConverted()
	doc.transact(() => {
		pointsArray.forEach((item) => {
			let fabObj = {id: uuidv4()}
			switch (item[0]) {
				case 'options':
					options = item[1]
					break
				case 'dashedLine':
					fabObj.strokeDashArray = [10, 10]
				// falls through
				case 'line':
					fabObj.type = 'line'
					fabObj.x1 = item[1][0]
					fabObj.y1 = item[1][1]
					fabObj.x2 = item[1][2]
					fabObj.y2 = item[1][3]
					fabObj.axes = false
					fabObj.stroke = options.strokeStyle
					fabObj.strokeWidth = options.lineWidth
					ids.push(fabObj.id)
					yDrawingMap.set(fabObj.id, fabObj)
					break
				case 'rrect':
					fabObj.rx = 10
					fabObj.ry = 10
				// falls through
				case 'rect':
					fabObj.type = 'rect'
					fabObj.left = item[1][0]
					fabObj.top = item[1][1]
					fabObj.width = item[1][2]
					fabObj.height = item[1][3]
					fabObj.fill = options.fillStyle
					if (fabObj.fill === 'rgb(255, 255, 255)' || fabObj.fill === '#ffffff')
						fabObj.fill = 'rgba(0, 0, 0, 0)'
					fabObj.stroke = options.strokeStyle
					fabObj.strokeWidth = options.lineWidth
					ids.push(fabObj.id)
					yDrawingMap.set(fabObj.id, fabObj)
					break
				case 'text':
					fabObj.type = 'text'
					fabObj.fill = options.fillStyle
					fabObj.fontSize = Number.parseInt(options.font)
					fabObj.text = item[1][0]
					fabObj.left = item[1][1]
					fabObj.top = item[1][2]
					ids.push(fabObj.id)
					yDrawingMap.set(fabObj.id, fabObj)
					break
				case 'image':
					{
						// this is a bit complicated because we have to allow for the async onload of the image
						let image = new Image()
						image.src = item[1][0]
						let promise = new Promise((resolve) => {
							image.onload = function () {
								let imageObj = new fabric.Image(image, {
									left: item[1][1],
									top: item[1][2],
									width: item[1][3],
									height: item[1][4],
								})
								fabObj.type = 'image'
								fabObj.imageObj = imageObj.toObject()
								resolve(fabObj)
							}
						})
						promise.then(() => {
							yDrawingMap.set(fabObj.id, fabObj)
							refreshFromMap([fabObj.id])
						})
					}
					break
				case 'pencil':
					// not implemented (yet)
					break
				case 'marker':
					{
						fabObj.type = 'circle'
						fabObj.fill = options.fillStyle
						fabObj.strokeWidth = 0
						fabObj.stroke = options.fillStyle
						fabObj.originX = 'center'
						fabObj.originY = 'center'
						fabObj.left = item[1][0]
						fabObj.top = item[1][1]
						fabObj.radius = item[1][2] / 2
						ids.push(fabObj.id)
						yDrawingMap.set(fabObj.id, fabObj)
					}
					break
				case 'endShape':
					break
			}
		})
	})
	refreshFromMap(ids)
}
/**
 * we don't want to convert v1 instructions into v2 objects more than once (to do so would duplicate
 * the objects), but we don't want to delete them either, as that would upset v1 users.  So quietly mark
 * the v1 instructions to show that they have already been converted
 */
function markConverted() {
	let first = yPointsArray.get(0)
	if (!first[1]) first[1] = {}
	first[1].converted = true
	yPointsArray.insert(0, [first])
}
function magicEraser() {
	/* for each circle, 
			find intersecting objects
			if not a circle, delete it
	delete all circles
	*/
	doc.transact(() => {
		canvas
			.getObjects()
			.filter((obj) => obj.type === 'circle' && obj.fill === '#ffffff')
			.forEach((circle) =>
				canvas
					.getObjects()
					.filter((other) => circle.intersectsWithObject(other))
					.forEach((other) => canvas.remove(other))
			)
		canvas
			.getObjects()
			.filter((obj) => obj.type === 'circle' && obj.fill === '#ffffff')
			.forEach((obj) => canvas.remove(obj))
		canvas.getObjects().forEach((obj) => saveChange(obj, {}))
	})
}
window.magicEraser = magicEraser
