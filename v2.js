const init = () => {
  var $ = go.GraphObject.make;  // for more concise visual tree definitions

  myDiagram =
    $(go.Diagram, "myDiagramDiv",
      {
        initialScale: 2.5,
        "commandHandler.defaultScale": 1.5,
        allowLink: false,  // no user-drawn links
        draggingTool: new SnappingTool(),
        "undoManager.isEnabled": true,
        // allowVerticalScroll: false, 
        // "panningTool.isEnabled": false,
        'dragSelectingTool.isEnabled': false,
        "draggingTool.isCopyEnabled": false,
        maxSelectionCount: 1,
        allowClipboard: false,
        "textEditingTool.starting": go.TextEditingTool.SingleClick,
        "textEditingTool.doMouseDown": function() { if (this.isActive) {
          // Validates current text
          this.acceptText(go.TextEditingTool.MouseDown);

          // If current text is accepted
          if(this.state.va !== 'StateInvalid'){
            // Switches to other textblock
            var tb = this.diagram.findObjectAt(this.diagram.lastInput.documentPoint);
            if (tb instanceof go.TextBlock && tb.editable) { 
              var tool = this; 
              tool.textBlock = tb; 
              tool.diagram.currentTool = tool; 
            }
          }          
        }}
      });

  // Generic node template
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
          height: 300,
          width: 300,
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

  // Electron palette
  myPalette =
    $(go.Palette, "myPaletteDiv",
      {
        initialScale: 5,
        contentAlignment: go.Spot.Bottom,
        nodeTemplate: myDiagram.nodeTemplate,  // shared with the main Diagram
        "contextMenuTool.isEnabled": false,
        'dragSelectingTool.isEnabled': false,
        maxSelectionCount: 1,
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
            nodeDataArray: compoundShape[compoundParams[compound]['shape']]['palette']
          })  
      });  

  // Edited string should only contain string of <=2 letters
  const validElement = (textblock, oldstr, newstr) => {
    const lettersOnly = /^[a-zA-Z]+$/.test(newstr);
    return newstr.length <= 2 && lettersOnly
  }

  // Defining element name textblock template
  var elementName = 
    $(go.Node, 'Vertical',
      {movable: false, deletable: false},
      new go.Binding('position', 'position'),
      $(go.Shape,
        {width: 3, height: 3, margin: new go.Margin(0, 0, 3, 0)},
        new go.Binding('figure', 'shape')
      ),
      $(go.TextBlock,
        {
          editable: true,
          isMultiline: false,
          textValidation: validElement,
        },
        new go.Binding('text', 'elementName').makeTwoWay()
      )
    )
  myDiagram.nodeTemplateMap.add("elementName", elementName)

  // Defining structure for 2 element compound eg. HCl
  go.Shape.defineFigureGenerator("TwoElements", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var quarterCircle = w / 7
    var rad = quarterCircle*2
    var geo = new go.Geometry();
    // Left
    var fig = new go.PathFigure(rad*2, h/2);
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, h/2, rad, rad));

    // Right
    fig.add(new go.PathSegment(go.PathSegment.Move, w, h/2));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad, h/2, rad, rad));
    geo.add(fig);
    return geo;
  });

  // Defining structure for 3 element compound eg. CO2
  go.Shape.defineFigureGenerator("ThreeElements", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var quarterCircle = w / 10
    var rad = quarterCircle*2
    var geo = new go.Geometry();
    // Left
    var fig = new go.PathFigure(rad*2, h/2);
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, h/2, rad, rad));

    // Center
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, h/2));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, h/2, rad, rad));

    // Right
    fig.add(new go.PathSegment(go.PathSegment.Move, w, h/2));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad, h/2, rad, rad));
    
    geo.add(fig);
    return geo;
  });
  
  // Defining structure for 4 element compound eg. NH3
  go.Shape.defineFigureGenerator("FourElements", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var quarterCircle = w / 10
    var rad = quarterCircle*2
    var geo = new go.Geometry();
    // Left
    var fig = new go.PathFigure(rad*2, quarterCircle*5);  
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, quarterCircle*5, rad, rad));

    // Center
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, quarterCircle*5));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, quarterCircle*5, rad, rad));

    // Right
    fig.add(new go.PathSegment(go.PathSegment.Move, w, quarterCircle*5));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad, quarterCircle*5, rad, rad));

    // Top
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, rad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, rad, rad, rad));
    
    geo.add(fig);
    return geo;
  });

  // Defining structure for 4 element line compound eg. H2O2
  go.Shape.defineFigureGenerator("FourElementsRow", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var quarterCircle = w / 14
    var rad = quarterCircle*2
    var geo = new go.Geometry();
    // Left
    var fig = new go.PathFigure(rad*2, rad); 
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, rad, rad, rad));

    // CenterLeft
    fig.add(new go.PathSegment(go.PathSegment.Move, quarterCircle*7, rad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, quarterCircle*5, rad, rad, rad));

    // CenterRight
    fig.add(new go.PathSegment(go.PathSegment.Move, quarterCircle*10, rad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, quarterCircle*8, rad, rad, rad));

    // Right
    fig.add(new go.PathSegment(go.PathSegment.Move, quarterCircle*13, rad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, quarterCircle*11, rad, rad, rad));
    
    geo.add(fig);
    return geo;
  });

  // Defining structure for 4 element compound eg. CH4
  go.Shape.defineFigureGenerator("FiveElements", function(shape, w, h) {
    var param1 = shape ? shape.parameter1 : NaN;
    if (isNaN(param1) || param1 < 0) param1 = 8;
  
    var smallQuarter = w/10
    var smallRad = smallQuarter*1.5
    var bigRad = smallQuarter*3
    var geo = new go.Geometry();
    // Left
    var fig = new go.PathFigure(smallRad*2, smallQuarter*5);  
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, smallRad, smallQuarter*5, smallRad, smallRad));

    // Center
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2+bigRad, smallQuarter*5));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallQuarter*5, bigRad, bigRad));
    
    // Right
    fig.add(new go.PathSegment(go.PathSegment.Move, w, smallQuarter*5));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-smallRad, smallQuarter*5, smallRad, smallRad));
    
    // Top
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, smallRad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallRad, smallRad, smallRad));

    // Bottom
    fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, w-smallRad));
    fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, w-smallRad, smallRad, smallRad));
    
    geo.add(fig);
    return geo;
  });

  setCompound(compound)
}

// Ends TextEditingTool when clicking out of myDiagram
document.addEventListener("mousedown", function() {
  if(myDiagram.currentTool instanceof go.TextEditingTool){
    myDiagram.currentTool.acceptText(go.TextEditingTool.LostFocus);

    // Checking whether text is accepted
    // console.log(myDiagram.currentTool.state.va)
  }
});




// Examples
const compoundShape = {
  'TwoElements': {
    palette: [
      {
        type: 'electron',
        element: 'A',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "A", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'B',
        figshape: "Xline",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "B", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
    ],
    data :[{
      height: 120,
      width: 200,
      figshape: "TwoElements",
      ports: [
        { id: "A1", spot: "0 0.48" },    //left
        { id: "A2", spot: "0 0.52" },
        { id: "A3", spot: "0.27 0.02" }, //top
        { id: "A4", spot: "0.3 0.02" },
        { id: "A5", spot: "0.27 0.98" }, //bottom
        { id: "A6", spot: "0.3 0.98" },
  
        { id: "B1", spot: "1 0.48" },    //right
        { id: "B2", spot: "1 0.52" },
        { id: "B3", spot: "0.7 0.02" },  //top
        { id: "B4", spot: "0.73 0.02" },
        { id: "B5", spot: "0.7 0.98" },  //bottom
        { id: "B6", spot: "0.73 0.98" },
  
        { id: "AB1", spot: "0.5 0.25" },
        { id: "AB2", spot: "0.5 0.35" },
        { id: "AB3", spot: "0.5 0.45" },
        { id: "AB4", spot: "0.5 0.55" },
        { id: "AB5", spot: "0.5 0.65" },
        { id: "AB6", spot: "0.5 0.75" },
        ],
        selectable: false,
        movable: false
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(55, 50),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(142, 50),
        category: 'elementName',
        shape: 'Xline',
    }],
    hasCentral: false,
    template: [0, 0],
    reference: ['A', 'AB', 'B'],
    distributionTemplate: [0, 0, 0],
  },

  'ThreeElements': {
    palette: [
      {
        type: 'electron',
        element: 'A',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "A", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'B',
        figshape: "Xline",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "B", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'C',
        figshape: "Diamond",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "C", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
    ],
    data: [{
      height: 120,
      width: 300,
      figshape: "ThreeElements",
      ports: [
        { id: "B1", spot: "0 0.48" },   //left
        { id: "B2", spot: "0 0.52" },
        { id: "B3", spot: "0.19 0" },   //top   
        { id: "B4", spot: "0.21 0" },
        { id: "B5", spot: "0.19 1" },   //bottom
        { id: "B6", spot: "0.21 1" },
  
        { id: "A1", spot: "0.49 0" },   //top
        { id: "A2", spot: "0.51 0" },
        { id: "A3", spot: "0.49 1" },   //bottom
        { id: "A4", spot: "0.51 1" },
  
        { id: "C1", spot: "1 0.48" },   //right
        { id: "C2", spot: "1 0.52" },
        { id: "C3", spot: "0.79 0" },   //top
        { id: "C4", spot: "0.81 0" },
        { id: "C5", spot: "0.79 1" },   //bottom
        { id: "C6", spot: "0.81 1" },
  
        { id: "AB1", spot: "0.35 0.25" },
        { id: "AB2", spot: "0.35 0.35" },
        { id: "AB3", spot: "0.35 0.45" },
        { id: "AB4", spot: "0.35 0.55" },
        { id: "AB5", spot: "0.35 0.65" },
        { id: "AB6", spot: "0.35 0.75" },
  
        { id: "AC1", spot: "0.65 0.25" },
        { id: "AC2", spot: "0.65 0.35" },
        { id: "AC3", spot: "0.65 0.45" },
        { id: "AC4", spot: "0.65 0.55" },
        { id: "AC5", spot: "0.65 0.65" },
        { id: "AC6", spot: "0.65 0.75" },
      ],
      selectable: false,
      movable: false
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(148, 50),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(57, 50),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(238, 50),
        category: 'elementName',
        shape: 'Diamond',
    }],
    hasCentral: true,
    template: [0, 0, 0],
    reference: [['A', ''], ['B', 'AB'], ['C', 'AC']],
    distributionTemplate: [[0, 0], [0, 0], [0, 0]],
  },

  'FourElements': {
    palette: [
      {
        type: 'electron',
        element: 'A',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "A", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'B',
        figshape: "Xline",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "B", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'C',
        figshape: "Diamond",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "C", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'D',
        figshape: "Triangle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "D", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
    ],
    data: [{
      height: 210,
      width: 300,
      figshape: "FourElements",
      ports: [
        { id: "B1", spot: "0 0.7" },    //left
        { id: "B2", spot: "0 0.72" },   
        { id: "B3", spot: "0.19 0.425" },    //top
        { id: "B4", spot: "0.21 0.425" },
        { id: "B5", spot: "0.19 1" },    //bottom
        { id: "B6", spot: "0.21 1" },
  
        { id: "A1", spot: "0.49 1" },    //bottom
        { id: "A2", spot: "0.51 1" },
  
        { id: "C1", spot: "1 0.7" },    //right
        { id: "C2", spot: "1 0.72" },
        { id: "C3", spot: "0.79 0.425" },    //top
        { id: "C4", spot: "0.81 0.425" },
        { id: "C5", spot: "0.79 1" },    //bottom
        { id: "C6", spot: "0.81 1" },

        { id: "D1", spot: "0.49 0" },   //top
        { id: "D2", spot: "0.51 0" },
        { id: "D3", spot: "0.3 0.28" },    //left
        { id: "D4", spot: "0.3 0.3" },
        { id: "D5", spot: "0.7 0.28" },    //right
        { id: "D6", spot: "0.7 0.3" },
  
        { id: "AB1", spot: "0.35 0.59" },
        { id: "AB2", spot: "0.35 0.64" },
        { id: "AB3", spot: "0.35 0.69" },
        { id: "AB4", spot: "0.35 0.74" },
        { id: "AB5", spot: "0.35 0.79" },
        { id: "AB6", spot: "0.35 0.84" },

        { id: "AD1", spot: "0.4 0.5" },
        { id: "AD2", spot: "0.44 0.5" },
        { id: "AD3", spot: "0.48 0.5" },
        { id: "AD4", spot: "0.52 0.5" },
        { id: "AD5", spot: "0.56 0.5" },
        { id: "AD6", spot: "0.6 0.5" },

        { id: "AC1", spot: "0.65 0.59" },
        { id: "AC2", spot: "0.65 0.64" },
        { id: "AC3", spot: "0.65 0.69" },
        { id: "AC4", spot: "0.65 0.74" },
        { id: "AC5", spot: "0.65 0.79" },
        { id: "AC6", spot: "0.65 0.84" },
      ],
      selectable: false,
      movable: false,
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(148, 140),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(58, 140),
        category: 'elementName',
        shape: 'Xline',
      },

      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(238, 140),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(148, 50),
        category: 'elementName',
        shape: 'Triangle',
      }
    ],
    hasCentral: true,
    template: [0, 0, 0, 0],
    reference: [['A', ''], ['B', 'AB'], ['C', 'AC'], ['D', 'AD']],
    distributionTemplate: [[0, 0], [0, 0], [0, 0], [0, 0]],
  },

  'FourElementsRow': {
    palette: [
      {
        type: 'electron',
        element: 'A',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "A", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'B',
        figshape: "Xline",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "B", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'C',
        figshape: "Diamond",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "C", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'D',
        figshape: "Triangle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "D", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
    ],
    data: [{
      height: 115,
      width: 400,
      figshape: "FourElementsRow",
      ports: [
        { id: "A1", spot: "0 0.48" },    //left
        { id: "A2", spot: "0 0.52" },   
        { id: "A3", spot: "0.135 0" },    //top
        { id: "A4", spot: "0.15 0" },
        { id: "A5", spot: "0.135 1" },    //bottom
        { id: "A6", spot: "0.15 1" },
  
        { id: "B1", spot: "0.35 1" },    //bottom
        { id: "B2", spot: "0.365 1" },
        { id: "B3", spot: "0.35 0" },    //top
        { id: "B4", spot: "0.365 0" },
  
        { id: "C1", spot: "0.565 0" },    //top
        { id: "C2", spot: "0.58 0" },
        { id: "C3", spot: "0.565 1" },    //bottom
        { id: "C4", spot: "0.58 1" },

        { id: "D1", spot: "0.78 0" },    //top
        { id: "D2", spot: "0.795 0" },
        { id: "D3", spot: "0.78 1" },    //bottom
        { id: "D4", spot: "0.795 1" },
        { id: "D5", spot: "0.93 0.48" },    //bottom
        { id: "D6", spot: "0.93 0.52" },        
  
        { id: "AB1", spot: "0.25 0.25" },
        { id: "AB2", spot: "0.25 0.35" },
        { id: "AB3", spot: "0.25 0.45" },
        { id: "AB4", spot: "0.25 0.55" },
        { id: "AB5", spot: "0.25 0.65" },
        { id: "AB6", spot: "0.25 0.75" },

        { id: "BC1", spot: "0.465 0.25" },
        { id: "BC2", spot: "0.465 0.35" },
        { id: "BC3", spot: "0.465 0.45" },
        { id: "BC4", spot: "0.465 0.55" },
        { id: "BC5", spot: "0.465 0.65" },
        { id: "BC6", spot: "0.465 0.75" },

        { id: "CD1", spot: "0.68 0.25" },
        { id: "CD2", spot: "0.68 0.35" },
        { id: "CD3", spot: "0.68 0.45" },
        { id: "CD4", spot: "0.68 0.55" },
        { id: "CD5", spot: "0.68 0.65" },
        { id: "CD6", spot: "0.68 0.75" },
      ],
      selectable: false,
      movable: false,
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(55, 50),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(141, 50),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(226, 50),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(312, 50),
        category: 'elementName',
        shape: 'Triangle',
      }
    ],
    hasCentral: false,
    template: [0, 0, 0, 0],
    reference: ['A', 'AB', 'B', 'BC', 'C', 'CD', 'D'],
    distributionTemplate: [0, 0, 0, 0, 0, 0, 0],
  },

  'FiveElements': {
    palette: [
      {
        type: 'electron',
        element: 'A',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "A", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'B',
        figshape: "Xline",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "B", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'C',
        figshape: "Diamond",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "C", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'D',
        figshape: "Triangle",
        height: 5,
        width: 5,
        fill: "#000",
        ports: [
          { id: "D", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
      {
        type: 'electron',
        element: 'E',
        figshape: "Square",
        height: 4,
        width: 4,
        fill: "#000",
        ports: [
          { id: "E", spot: "0.5 0.5", fill: null },
        ],
        textvisible: false
      },
    ],
    data: [{
      height: 300,
      width: 300,
      figshape: "FiveElements",
      ports: [
        { id: "B1", spot: "0 0.49" },    //left
        { id: "B2", spot: "0 0.51" },   
        { id: "B3", spot: "0.14 0.35" },    //top
        { id: "B4", spot: "0.16 0.35" },
        { id: "B5", spot: "0.14 0.65" },    //bottom
        { id: "B6", spot: "0.16 0.65" },

        { id: "A1", spot: "0.31 0.27" },    //top left
        { id: "A2", spot: "0.29 0.29" },   
        { id: "A3", spot: "0.69 0.27" },    // top right
        { id: "A4", spot: "0.71 0.29" },
        { id: "A5", spot: "0.69 0.73" },    //bottom right
        { id: "A6", spot: "0.71 0.71" },
        { id: "A7", spot: "0.31 0.73" },    //bottom left
        { id: "A8", spot: "0.29 0.71" },
  
        { id: "D1", spot: "1 0.49" },    //right
        { id: "D2", spot: "1 0.51" },   
        { id: "D3", spot: "0.84 0.35" },    //top
        { id: "D4", spot: "0.86 0.35" },
        { id: "D5", spot: "0.84 0.65" },    //bottom
        { id: "D6", spot: "0.86 0.65" },
        
        { id: "C1", spot: "0.35 0.14" },    //left
        { id: "C2", spot: "0.35 0.16" },   
        { id: "C3", spot: "0.65 0.14" },    //right
        { id: "C4", spot: "0.65 0.16" },
        { id: "C5", spot: "0.49 0" },    //top
        { id: "C6", spot: "0.51 0" },

        { id: "E1", spot: "0.35 0.84" },    //left
        { id: "E2", spot: "0.35 0.86" },   
        { id: "E3", spot: "0.65 0.84" },    //right
        { id: "E4", spot: "0.65 0.86" },
        { id: "E5", spot: "0.49 1" },    //top
        { id: "E6", spot: "0.51 1" },
  
        { id: "AB1", spot: "0.24 0.4" },
        { id: "AB2", spot: "0.24 0.44" },
        { id: "AB3", spot: "0.24 0.48" },
        { id: "AB4", spot: "0.24 0.52" },
        { id: "AB5", spot: "0.24 0.56" },
        { id: "AB6", spot: "0.24 0.6" },

        { id: "AD1", spot: "0.76 0.4" },
        { id: "AD2", spot: "0.76 0.44" },
        { id: "AD3", spot: "0.76 0.48" },
        { id: "AD4", spot: "0.76 0.52" },
        { id: "AD5", spot: "0.76 0.56" },
        { id: "AD6", spot: "0.76 0.6" },

        { id: "AC1", spot: "0.4 0.24" },
        { id: "AC2", spot: "0.44 0.24" },
        { id: "AC3", spot: "0.48 0.24" },
        { id: "AC4", spot: "0.52 0.24" },
        { id: "AC5", spot: "0.56 0.24" },
        { id: "AC6", spot: "0.6 0.24" },

        { id: "AE1", spot: "0.4 0.76" },
        { id: "AE2", spot: "0.44 0.76" },
        { id: "AE3", spot: "0.48 0.76" },
        { id: "AE4", spot: "0.52 0.76" },
        { id: "AE5", spot: "0.56 0.76" },
        { id: "AE6", spot: "0.6 0.76" },
      ],
      selectable: false,
      movable: false,
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(148, 140),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(40, 140),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(148, 35),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(255, 140),
        category: 'elementName',
        shape: 'Triangle',
      },
      {
        type: 'elementName',
        element: 'E',
        elementName: 'E',
        position: new go.Point(148, 250),
        category: 'elementName',
        shape: 'Square',
      }
    ],
    hasCentral: true,
    template: [0, 0, 0, 0, 0],
    reference: [['A', ''], ['B', 'AB'], ['C', 'AC'], ['D', 'AD'], ['E', 'AE']],
    distributionTemplate: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  }
}

const compoundParams = {
  'HCl': {
    styledName: 'HCl',
    shape: 'TwoElements',
    hasCentral: false,
    answerArray: ['H', 'Cl'],
    total: 8,
    individual: [1, 7],
    distribution: [0, 2, 6]
  },

  'CO2': {
    styledName: 'CO<sub>2</sub>',
    shape: 'ThreeElements',
    hasCentral: true,
    answerArray: ['C', 'O', 'O'],
    total: 16,
    individual: [4, 6, 6],
    distribution: [[0, 0], [4, 4], [4, 4]]
  },

  'NH3': {
    styledName: 'NH<sub>3</sub>',
    shape: 'FourElements',
    hasCentral: true,
    answerArray: ['N', 'H', 'H', 'H'],
    total: 8,
    individual: [5, 1, 1, 1],
    distribution: [[2, 0], [0, 2], [0, 2], [0, 2]]
  },

  'H2O2': {
    styledName: 'H<sub>2</sub>O<sub>2</sub>',
    shape: 'FourElementsRow',
    hasCentral: false,
    answerArray: ['H', 'O', 'O', 'H'],
    total: 14,
    individual: [1, 6, 6, 1],
    distribution: [0, 2, 4, 2, 4, 2, 0]
  },

  'CH4': {
    styledName: 'CH<sub>4</sub>',
    shape: 'FiveElements',
    hasCentral: true,
    answerArray: ['C', 'H', 'H', 'H', 'H'],
    total: 8,
    individual: [4, 1, 1, 1, 1],
    distribution: [[0, 0], [0, 2], [0, 2], [0, 2], [0, 2]]
  },
}
const indexing = {'A':0, 'B':1, 'C':2, 'D':3, 'E':4}
var compound = 'HCl';
var selected = null;





// Helper functions
const setCompound = (x) => {
  compound = x
  // Update diagram data
  myDiagram.startTransaction()
  myDiagram.model.nodeDataArray = []
  myDiagram.model.linkDataArray = []
  myDiagram.model.nodeDataArray = [...compoundShape[compoundParams[compound]['shape']]['data']]
  myDiagram.commitTransaction()

  // Update palette data
  myPalette.startTransaction()
  myPalette.model.nodeDataArray = []
  myPalette.model.nodeDataArray = [...compoundShape[compoundParams[compound]['shape']]['palette']]
  myPalette.commitTransaction()

  // Update covers
  covers = document.getElementsByClassName('compoundName')
  for(let i of covers){
    i.innerHTML = compoundParams[x].styledName
  }

  // Update legend
  const electrons = ['A', 'B', 'C', 'D', 'E']
  const curr_num = myPalette.model.nodeDataArray.length
  for(let i = 0; i < electrons.length; i++){
    document.getElementById(electrons[i]).style.display = i < curr_num ? 'block' : 'none'
  }

  // Update result string
  updateResult('Check answer to see your results.')
}

const deleteSelected = () => {
  selected = myDiagram.selection.first() !== null ? myDiagram.selection.first().tb : null
  if(selected === null || selected.type !== 'electron'){return}
  var node = myDiagram.findNodeForKey(selected.key);
  if (node !== null) {
    myDiagram.startTransaction();
    myDiagram.remove(node);
    myDiagram.commitTransaction("deleted node");
  }
}

const logSelected = () => {
  // console.log(selected)
  console.log(myDiagram.selection.first())
  console.log(myDiagram.selection.first().tb.__gohashid)
  // console.log(myDiagram.model.nodeDataArray)
}

const logData = () => {
  console.log(myDiagram.model.nodeDataArray)
  console.log(myDiagram.model.linkDataArray)
}





// Marking functions
const getElementNames = (nodeData) => {
  var elementNames = []
  for(let i of nodeData){
    // If item is textblock, add into array
    if('elementName' in i){
      elementNames.push(i.elementName)
    }
  }
  return elementNames
}

const checkElementNames = (elementName, ans) => {

  if(ans.hasCentral === false){
    if(JSON.stringify(elementName) === JSON.stringify(ans.answerArray)){
      return 1
    } else if (JSON.stringify(elementName) === JSON.stringify([...ans.answerArray].reverse())) {
      return 2
    }
  } else {
    if(JSON.stringify(elementName) === JSON.stringify(ans.answerArray)){
      return 1
    }
  }

  return false
}

const checkElectronNumbers = (nodeData, ans, reversed) => {
  var template = [...compoundShape[ans.shape].template]
  var ansArray = reversed === false ? JSON.stringify(ans.individual) : JSON.stringify([...ans.individual].reverse())
  var total = 0;

  for(let node of nodeData){
    if(node.type === 'electron'){
      template[indexing[node.element]]++
      total++
    }
  }

  if(total !== ans.total){
    return 1
  } else if (JSON.stringify(template) !== ansArray) {
    return 2
  } else {
    return 0
  }
}

const getElectrons = (linkData, ans) => {
  var distributionTemplate = compoundShape[ans.shape].distributionTemplate
  var electronArray = JSON.parse(JSON.stringify(distributionTemplate))
  const reference = compoundShape[ans.shape].reference
  var element;
  var secondElement;
  var index;
  for(let i of linkData){

    // Check for validity of placement; whether the electron and element name are compatible
    if(i['tid'].indexOf(i['fid']) === -1){
      return 0
    }

    // Adds to template for accounting number of electrons later
    if(ans.hasCentral === false){
      if(i['tid'].length === 2){
        element = i['tid'][0]
        index = reference.indexOf(element)
        electronArray[index]++
      } else {
        element = i['tid'].substring(0, 2)
        index = reference.indexOf(element)
        electronArray[index]++
      }
    } else {
      if(i['tid'].length === 2){
        element = i['tid'][0]
        index = indexing[element]
        electronArray[index][0]++
      } else {
        secondElement = i['tid'].substring(1, 2)
        element = i['tid'].substring(0, 2)
        index = indexing[secondElement]
        electronArray[index][1]++
      }
    }
  }

  return electronArray
}

const checkElectronDistribution = (electrons, ans, reversed) => {

  if(ans.hasCentral){
    var inputCentral = [...electrons[0]]
    var ansCentral = [...ans.distribution[0]]
    var inputPeripheral = electrons.slice(1)
    var ansPeripheral = ans.distribution.slice(1)

    // Check central
    if(JSON.stringify(ansCentral) !== JSON.stringify(inputCentral)){
      return false
    }

    for(let i of inputPeripheral){
      for(let a of ansPeripheral){
        if(JSON.stringify(i) === JSON.stringify(a)){
          var index = ansPeripheral.indexOf(a)
          ansPeripheral.splice(index, 1)
          break
        }
      }
    }
    return ansPeripheral.length === 0 ? true : false
  } else {
    var input = JSON.stringify([...electrons])
    var ans = reversed === false ? JSON.stringify([...ans.distribution]) : JSON.stringify([...ans.distribution].reverse())

    return input == ans ? true : false
  }
}

const check = () => {
  const nodeData = myDiagram.model.nodeDataArray
  const linkData = myDiagram.model.linkDataArray
  const ans = compoundParams[compound]

  var elementNames = getElementNames(nodeData)
  var validNames = checkElementNames(elementNames, ans)
  if(!validNames){
    updateResult('Element names wrong.')
    return
  }
  var reversed = validNames === 2 ? true : false

  var checkNumbers = checkElectronNumbers(nodeData, ans, reversed)
  if(checkNumbers === 1){
    updateResult('Total number of electrons wrong.')
    return
  } else if (checkNumbers === 2) {
    updateResult('You may have used the wrong electrons for some elements. Make sure to follow the electron legend.')
    return
  }

  var electrons = getElectrons(linkData, ans)
  if(electrons === 0){
    updateResult('Total number of electrons right but invalid electron placement.')
    return
  }

  if(checkElectronDistribution(electrons, ans, reversed)){
    updateResult('Your answer is correct.')
    return
  } else {
    updateResult('Your electron placement is wrong.')
    return
  }
}

const updateResult = (result) => {
  document.getElementById('results').innerText = result
  if(result === 'Your answer is correct.'){
    document.getElementById('results').style.color = 'green'
  } else if(result === 'Check answer to see your results.') {
    document.getElementById('results').style.color = 'black'
  } else {
    document.getElementById('results').style.color = 'red'
  }
}





// Define a custom DraggingTool
function SnappingTool() {
  go.DraggingTool.call(this);
}
go.Diagram.inherit(SnappingTool, go.DraggingTool);

// This predicate checks to see if the ports can snap together.
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
  myDiagram.startTransaction()
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
    myDiagram.commitTransaction()
    return coll;
  } else {
    var map = new go.Map(/*go.Part, Object*/);
    if (parts === null) return map;
    var tool = this;
    parts.iterator.each(function(n) {
      tool.gatherConnecteds(map, n);
    });
    myDiagram.commitTransaction()
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

window.addEventListener('DOMContentLoaded', init);