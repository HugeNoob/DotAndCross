var selected = null;

function init() {
  var $ = go.GraphObject.make;  // for more concise visual tree definitions

  myDiagram =
    $(go.Diagram, "myDiagramDiv",
      {
        initialScale: 2.5,
        "commandHandler.defaultScale": 1.5,
        allowLink: false,  // no user-drawn links
        // use a custom DraggingTool instead of the standard one, defined below
        draggingTool: new SnappingTool(),
        "undoManager.isEnabled": true,
        allowVerticalScroll: false, 
        "panningTool.isEnabled": false,
        'dragSelectingTool.isEnabled': false,
      });

  // Define the generic "pipe" Node.
  // The Shape gets it Geometry from a geometry path string in the bound data.
  // This node also gets all of its ports from an array of port data in the bound data.
  myDiagram.nodeTemplate =
    $(go.Node, "Spot",
      {
        locationObjectName: "SHAPE",
        locationSpot: go.Spot.Center,
        selectionAdorned: false,  // use a Binding on the Shape.stroke to show selection
        itemTemplate:
          // each port is a Circle whose alignment spot and port ID are given by the item data
          $(go.Panel,
            new go.Binding("portId", "id"),
            new go.Binding("alignment", "spot", go.Spot.parse),
            $(go.Shape, "Circle",
              { width: 2, height: 2, background: "transparent", fill: 'red', stroke: null },
              new go.Binding('fill', 'fill')
              ),
          ),
        // hide a port when it is connected
        linkConnected: function(node, link, port) {
          if (link.category === ""){
            myDiagram.startTransaction();
            port.visible = false;
            node.movable = false
            myDiagram.commitTransaction()
          }
        },
        linkDisconnected: function(node, link, port) {
          if (link.category === ""){
            myDiagram.startTransaction();
            port.visible = true;
            node.movable = true
            myDiagram.commitTransaction()
          }
        },
        selectable: true,
      },
      // new go.Binding('movable', 'movable'),
      new go.Binding('selectable', 'selectable'),
      // this creates the variable number of ports for this Spot Panel, based on the data
      new go.Binding("itemArray", "ports"),
      // remember the location of this Node
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      // move a selected part into the Foreground layer, so it isn't obscured by any non-selected parts
      new go.Binding("layerName", "isSelected", function(s) { return s ? "Foreground" : ""; }).ofObject(),      
      $(go.Shape,
        {
          name: "SHAPE",
          // the following are default values;
          // actual values may come from the node data object via data binding
          height: 120,
          width: 200,
          fill: null,
        },
        new go.Binding('height', 'height'),
        new go.Binding('width', 'width'),
        new go.Binding('fill', 'fill'),
        // this determines the actual shape of the Shape
        new go.Binding("figure", "figshape"),
        // selection causes the stroke to be blue instead of black
        new go.Binding("stroke", "isSelected", function(s) { return s ? "dodgerblue" : "black"; }).ofObject()),

    );

  // no visual representation of any link data
  myDiagram.linkTemplate = $(go.Link, { visible: false });

  // this model needs to know about particular ports
  myDiagram.model =
    $(go.GraphLinksModel,
      {
        copiesArrays: true,
        copiesArrayObjects: true,
        linkFromPortIdProperty: "fid",
        linkToPortIdProperty: "tid"
      });

  myPalette =
    $(go.Palette, "myPaletteDiv",
      {
        initialScale: 5,
        contentAlignment: go.Spot.Bottom,
        nodeTemplate: myDiagram.nodeTemplate,  // shared with the main Diagram
        "contextMenuTool.isEnabled": false,
        layout: $(go.GridLayout,
          {
            cellSize: new go.Size(1, 1), spacing: new go.Size(5, 5),
          }),
        // initialize the Palette with a few "pipe" nodes
        model: $(go.GraphLinksModel,
          {
            copiesArrays: true,
            copiesArrayObjects: true,
            linkFromPortIdProperty: "fid",
            linkToPortIdProperty: "tid",
            nodeDataArray: [
              {
                figshape: "Circle",
                height: 5,
                width: 5,
                fill: "#000",
                ports: [
                  { id: "1", spot: "0.5 0.5", fill: null },
                ],
                textvisible: false
              },
              {
                figshape: "Xline",
                height: 5,
                width: 5,
                fill: "#000",
                ports: [
                  { id: "1", spot: "0.5 0.5", fill: null },
                ],
                textvisible: false
              },
              {
                figshape: "Diamond",
                height: 5,
                width: 5,
                fill: "#000",
                ports: [
                  { id: "1", spot: "0.5 0.5", fill: null },
                ],
                textvisible: false
              },
            ]  // end nodeDataArray
          })  // end model
      });  

  // Defining structure for 2 element compound
  go.Shape.defineFigureGenerator("DoubleCircle", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var quarterCircle = w / 7
    var rad = quarterCircle*2
    var geo = new go.Geometry();
    var fig = new go.PathFigure(rad*2, h/2);
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, h/2, rad, rad));
    fig.add(new go.PathSegment(go.PathSegment.Move, w, h/2));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad, h/2, rad, rad));
    geo.add(fig);
    return geo;
  });
  
  // Binds double clicked element for deletion
  myDiagram.addDiagramListener("ObjectDoubleClicked", (e) => {
    selected = e.subject.part.data
  })

  const validElement = (textblock, oldstr, newstr) => {
    const lettersOnly = /^[a-zA-Z]+$/.test(newstr);
    return newstr.length <= 2 && lettersOnly
  }
  var elementName = 
    $(go.Node, 'Auto',
      {movable: false},
      new go.Binding('position', 'position'),
      $(go.TextBlock,
        {
          editable: true,
          isMultiline: false,
          textValidation: validElement
        },
        new go.Binding('text', 'elementName').makeTwoWay()
      )
    )
  myDiagram.nodeTemplateMap.add("elementName", elementName)

  // Compound structure given to student
  myDiagram.model.nodeDataArray = [
    {
      figshape: "DoubleCircle",
      ports: [
        { id: "Aleft1", spot: "0 0.46" },
        { id: "Aleft2", spot: "0 0.54" },
        { id: "Atop1", spot: "0.26 0.02" },
        { id: "Atop2", spot: "0.3 0.02" },
        { id: "Abottom1", spot: "0.26 0.98" },
        { id: "Abottom2", spot: "0.3 0.98" },

        { id: "Bright1", spot: "1 0.46" },
        { id: "Bright2", spot: "1 0.54" },
        { id: "Btop1", spot: "0.7 0.02" },
        { id: "Btop2", spot: "0.74 0.02" },
        { id: "Bbottom1", spot: "0.7 0.98" },
        { id: "Bbottom2", spot: "0.74 0.98" },

        { id: "centre1", spot: "0.5 0.25" },
        { id: "centre2", spot: "0.5 0.35" },
        { id: "centre3", spot: "0.5 0.45" },
        { id: "centre4", spot: "0.5 0.55" },
        { id: "centre5", spot: "0.5 0.65" },
        { id: "centre6", spot: "0.5 0.75" },
      ],
      selectable: false,
      movable: false
    },
    {
      name: 'LeftElement',
      elementName: 'A',
      position: new go.Point(55, 55),
      category: 'elementName'
    },
    {
      name: 'RightElement',
      elementName: 'B',
      position: new go.Point(140, 55),
      category: 'elementName'
    }
  ]
}

// Define a custom DraggingTool
function SnappingTool() {
  go.DraggingTool.call(this);
}
go.Diagram.inherit(SnappingTool, go.DraggingTool);

// This predicate checks to see if the ports can snap together.
// The first letter of the port id should be "U", "F", or "M" to indicate which kinds of port may connect.
// The second letter of the port id should be a digit to indicate which direction it may connect.
// The ports also need to not already have any link connections and need to face opposite directions.
SnappingTool.prototype.compatiblePorts = function(p1, p2) {
  // already connected?
  var part1 = p1.part;
  var id1 = p1.portId;
  if (id1 === null || id1 === "") return false;
  if (part1.findLinksConnected(id1).filter(function(l) { return l.category === ""; }).count > 0) return false;
  var part2 = p2.part;
  var id2 = p2.portId;
  if (id2 === null || id2 === "") return false;
  if (part2.findLinksConnected(id2).filter(function(l) { return l.category === ""; }).count > 0) return false;
  return true
};

// Override this method to find the offset such that a moving port can
// be snapped to be coincident with a compatible stationary port,
// then move all of the parts by that offset.
SnappingTool.prototype.moveParts = function(parts, offset, check) {
  // when moving an actually copied collection of Parts, use the offset that was calculated during the drag
  if (this._snapOffset && this.isActive && this.diagram.lastInput.up && parts === this.copiedParts) {
    go.DraggingTool.prototype.moveParts.call(this, parts, this._snapOffset, check);
    this._snapOffset = undefined;
    return;
  }

  var commonOffset = offset;

  // find out if any snapping is desired for any Node being dragged
  var sit = parts.iterator;
  while (sit.next()) {
    var node = sit.key;
    if (!(node instanceof go.Node)) continue;
    var info = sit.value;
    var newloc = info.point.copy().add(offset);

    // now calculate snap point for this Node
    var snapoffset = newloc.copy().subtract(node.location);
    var nearbyports = null;
    var closestDistance = 20 * 20;  // don't bother taking sqrt
    var closestPort = null;
    var closestPortPt = null;
    var nodePort = null;
    var mit = node.ports;
    while (mit.next()) {
      var port = mit.value;
      if (node.findLinksConnected(port.portId).filter(function(l) { return l.category === ""; }).count > 0) continue;
      var portPt = port.getDocumentPoint(go.Spot.Center);
      portPt.add(snapoffset);  // where it would be without snapping

      if (nearbyports === null) {
        // this collects the Nodes that intersect with the NODE's bounds,
        // excluding nodes that are being dragged (i.e. in the PARTS collection)
        var nearbyparts = this.diagram.findObjectsIn(node.actualBounds,
          function(x) { return x.part; },
          function(p) { return !parts.has(p); },
          true);

        // gather a collection of GraphObjects that are stationary "ports" for this NODE
        nearbyports = new go.Set(/*go.GraphObject*/);
        nearbyparts.each(function(n) {
          if (n instanceof go.Node) {
            nearbyports.addAll(n.ports);
          }
        });
      }

      var pit = nearbyports.iterator;
      while (pit.next()) {
        var p = pit.value;
        if (!this.compatiblePorts(port, p)) continue;
        var ppt = p.getDocumentPoint(go.Spot.Center);
        var d = ppt.distanceSquaredPoint(portPt);
        if (d < closestDistance) {
          closestDistance = d;
          closestPort = p;
          closestPortPt = ppt;
          nodePort = port;
        }
      }
    }

    // found something to snap to!
    if (closestPort !== null) {
      // move the node so that the compatible ports coincide
      var noderelpt = nodePort.getDocumentPoint(go.Spot.Center).subtract(node.location);
      var snappt = closestPortPt.copy().subtract(noderelpt);
      // save the offset, to ensure everything moves together
      commonOffset = snappt.subtract(newloc).add(offset);
      // ignore any node.dragComputation function
      // ignore any node.minLocation and node.maxLocation
      break;
    }
  }

  // now do the standard movement with the single (perhaps snapped) offset
  this._snapOffset = commonOffset.copy();  // remember for mouse-up when copying
  go.DraggingTool.prototype.moveParts.call(this, parts, commonOffset, check);
};

// Establish links between snapped ports,
// and remove obsolete links because their ports are no longer coincident.
SnappingTool.prototype.doDropOnto = function(pt, obj) {
  go.DraggingTool.prototype.doDropOnto.call(this, pt, obj);
  var tool = this;
  // Need to iterate over all of the dropped nodes to see which ports happen to be snapped to stationary ports
  var coll = this.copiedParts || this.draggedParts;
  var it = coll.iterator;
  while (it.next()) {
    var node = it.key;
    if (!(node instanceof go.Node)) continue;
    // connect all snapped ports of this NODE (yes, there might be more than one) with links
    var pit = node.ports;
    while (pit.next()) {
      var port = pit.value;
      // maybe add a link -- see if the port is at another port that is compatible
      var portPt = port.getDocumentPoint(go.Spot.Center);
      if (!portPt.isReal()) continue;
      var nearbyports =
        this.diagram.findObjectsAt(portPt,
          function(x) {  // some GraphObject at portPt
            var o = x;
            // walk up the chain of panels
            while (o !== null && o.portId === null) o = o.panel;
            return o;
          },
          function(p) {  // a "port" Panel
            // the parent Node must not be in the dragged collection, and
            // this port P must be compatible with the NODE's PORT
            if (coll.has(p.part)) return false;
            var ppt = p.getDocumentPoint(go.Spot.Center);
            if (portPt.distanceSquaredPoint(ppt) >= 0.25) return false;
            return tool.compatiblePorts(port, p);
          });
      // did we find a compatible port?
      var np = nearbyports.first();
      if (np !== null) {
        // connect the NODE's PORT with the other port found at the same point
        this.diagram.toolManager.linkingTool.insertLink(node, port, np.part, np);
      }
    }
  }
};

// Just move selected nodes when SHIFT moving, causing nodes to be unsnapped.
// When SHIFTing, must disconnect all links that connect with nodes not being dragged.
// Without SHIFT, move all nodes that are snapped to selected nodes, even indirectly.
SnappingTool.prototype.computeEffectiveCollection = function(parts) {
  if (this.diagram.lastInput.shift) {
    var links = new go.Set(/*go.Link*/);
    var coll = go.DraggingTool.prototype.computeEffectiveCollection.call(this, parts);
    coll.iteratorKeys.each(function(node) {
      // disconnect all links of this node that connect with stationary node
      if (!(node instanceof go.Node)) return;
      node.findLinksConnected().each(function(link) {
        if (link.category !== "") return;
        // see if this link connects with a node that is being dragged
        var othernode = link.getOtherNode(node);
        if (othernode !== null && !coll.has(othernode)) {
          links.add(link);  // remember for later deletion
        }
      });
    });
    // outside of nested loops we can actually delete the links
    links.each(function(l) { l.diagram.remove(l); });
    return coll;
  } else {
    var map = new go.Map(/*go.Part, Object*/);
    if (parts === null) return map;
    var tool = this;
    parts.iterator.each(function(n) {
      tool.gatherConnecteds(map, n);
    });
    return map;
  }
};

// Find other attached nodes.
SnappingTool.prototype.gatherConnecteds = function(map, node) {
  if (!(node instanceof go.Node)) return;
  if (map.has(node)) return;
  // record the original Node location, for relative positioning and for cancellation
  map.add(node, new go.DraggingInfo(node.location));
  // now recursively collect all connected Nodes and the Links to them
  var tool = this;
  node.findLinksConnected().each(function(link) {
    if (link.category !== "") return;  // ignore comment links
    map.add(link, new go.DraggingInfo());
    tool.gatherConnecteds(map, link.getOtherNode(node));
  });
};
// end SnappingTool class

window.addEventListener('DOMContentLoaded', init);

const check = () => {
  console.log(selected)
}

const deleteSelected = () => {
  if(selected === null){return}
  var node = myDiagram.findNodeForKey(selected.key);
  if (node !== null) {
    myDiagram.startTransaction();
    myDiagram.remove(node);
    myDiagram.commitTransaction("deleted node");
  }
}

const data = () => {
  console.log(myDiagram.model.nodeDataArray)
  console.log(myDiagram.model.linkDataArray)
}