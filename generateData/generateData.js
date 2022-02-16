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
              nodeDataArray: [...compoundShape[currShape]['palette']]
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

    // Defining ion charge template, allowing for editing only for this generate data version
    var ionCharge = 
    $(go.Node, 'Vertical',
      {movable: false, deletable: false},
      new go.Binding('position', 'position'),
      $(go.TextBlock,
        {
          editable: true,
          isMultiline: false,
        },
        new go.Binding('text', 'ionCharge').makeTwoWay()
      )
    )
    myDiagram.nodeTemplateMap.add("ionCharge", ionCharge)
  
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

    // Defining structure for 2 element ion eg. OH=
    go.Shape.defineFigureGenerator("TwoElementsIon", function(shape, w, h) {
      var param1 = shape ? shape.parameter1 : NaN;
      if (isNaN(param1) || param1 < 0) param1 = 8;

      var quarterCircle = w / 8
      var rad = quarterCircle*2
      var geo = new go.Geometry();

      // Left bracket
      var fig = new go.PathFigure(20, 0);
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 120))
      fig.add(new go.PathSegment(go.PathSegment.Line, 20, 120))
      
      // Left circle
      fig.add(new go.PathSegment(go.PathSegment.Move, (rad*2)+20, h/2));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad+20, h/2, rad, rad));

      // Right circle
      fig.add(new go.PathSegment(go.PathSegment.Move, w-20, h/2));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad-20, h/2, rad, rad));

      // Right bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, w-20, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, w, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, w, h))
      fig.add(new go.PathSegment(go.PathSegment.Line, w-20, h))

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

    // Defining structure for 3 element ion eg. NO2-
    go.Shape.defineFigureGenerator("ThreeElementsIon", function(shape, w, h) {
      var param1 = shape ? shape.parameter1 : NaN;
      if (isNaN(param1) || param1 < 0) param1 = 8;

      var quarterCircle = w / 11
      var rad = quarterCircle*2
      var geo = new go.Geometry();

      // Left bracket
      var fig = new go.PathFigure(20, 0);
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 120))
      fig.add(new go.PathSegment(go.PathSegment.Line, 20, 120))

      // Left circle
      fig.add(new go.PathSegment(go.PathSegment.Move, rad*2+15, h/2));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad+15, h/2, rad, rad));

      // Center circle
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, h/2));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, h/2, rad, rad));

      // Right circle
      fig.add(new go.PathSegment(go.PathSegment.Move, w-15, h/2));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad-15, h/2, rad, rad));

      // Right bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, w-20, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, w, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, w, h))
      fig.add(new go.PathSegment(go.PathSegment.Line, w-20, h))
      
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
      var fig = new go.PathFigure(rad*2, quarterCircle*6);  
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad, quarterCircle*6, rad, rad));

      // Center
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, quarterCircle*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, quarterCircle*5, rad, rad));

      // Right
      fig.add(new go.PathSegment(go.PathSegment.Move, w, quarterCircle*6));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad, quarterCircle*6, rad, rad));

      // Top
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, rad));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, rad, rad, rad));
      
      geo.add(fig);
      return geo;
    });

    // Defining structure for 4 element ion eg. CO32-
    go.Shape.defineFigureGenerator("FourElementsIon", function(shape, w, h) {
      var param1 = shape ? shape.parameter1 : NaN;
      if (isNaN(param1) || param1 < 0) param1 = 8;

      var quarterCircle = 31
      var rad = quarterCircle*2
      var geo = new go.Geometry();
      // Left
      var fig = new go.PathFigure(rad*2+20, quarterCircle*6);  
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, rad+20, quarterCircle*6, rad, rad));

      // Center
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, quarterCircle*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, quarterCircle*5, rad, rad));

      // Right
      fig.add(new go.PathSegment(go.PathSegment.Move, w-20, quarterCircle*6));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-rad-20, quarterCircle*6, rad, rad));

      // Top
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2 + rad, rad));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, rad, rad, rad));

      // Left bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, 20, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, 250))
      fig.add(new go.PathSegment(go.PathSegment.Line, 20, 250))

      // Right bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, 320, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, 340, 0))
      fig.add(new go.PathSegment(go.PathSegment.Line, 340, 250))
      fig.add(new go.PathSegment(go.PathSegment.Line, 320, 250))
      
      geo.add(fig);
      return geo;
    });

    // Defining structure for 4 element row compound eg. H2O2
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
      var bigRad = smallQuarter*2
      var geo = new go.Geometry();
      // Left
      var fig = new go.PathFigure(smallRad*2+smallQuarter, smallQuarter*5);  
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, smallRad+smallQuarter, smallQuarter*5, smallRad, smallRad));

      // Center
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+bigRad, smallQuarter*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallQuarter*5, bigRad, bigRad));
      
      // Right
      fig.add(new go.PathSegment(go.PathSegment.Move, w-smallQuarter, smallQuarter*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-smallRad-smallQuarter, smallQuarter*5, smallRad, smallRad));
      
      // Top
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, smallRad+smallQuarter));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallRad+smallQuarter, smallRad, smallRad));

      // Bottom
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, w-smallRad-smallQuarter));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, w-smallRad-smallQuarter, smallRad, smallRad));
      
      geo.add(fig);
      return geo;
    });

    // Defining structure for 4 element ion eg. NH4+
    go.Shape.defineFigureGenerator("FiveElementsIon", function(shape, w, h) {
      var param1 = shape ? shape.parameter1 : NaN;
      if (isNaN(param1) || param1 < 0) param1 = 8;

      var smallQuarter = w/10
      var smallRad = smallQuarter*1.5
      var bigRad = smallQuarter*2
      var geo = new go.Geometry();
      // Left
      var fig = new go.PathFigure(smallRad*2+smallQuarter, smallQuarter*5);  
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, smallRad+smallQuarter, smallQuarter*5, smallRad, smallRad));

      // Center
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+bigRad, smallQuarter*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallQuarter*5, bigRad, bigRad));
      
      // Right
      fig.add(new go.PathSegment(go.PathSegment.Move, w-smallQuarter, smallQuarter*5));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w-smallRad-smallQuarter, smallQuarter*5, smallRad, smallRad));
      
      // Top
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, smallRad+smallQuarter));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, smallRad+smallQuarter, smallRad, smallRad));

      // Bottom
      fig.add(new go.PathSegment(go.PathSegment.Move, w/2+smallRad, w-smallRad-smallQuarter));
      fig.add(new go.PathSegment(go.PathSegment.Arc, 0, 360, w/2, w-smallRad-smallQuarter, smallRad, smallRad));
      
      // Left bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, 40, 30));
      fig.add(new go.PathSegment(go.PathSegment.Line, 10, 30))
      fig.add(new go.PathSegment(go.PathSegment.Line, 10, 300))
      fig.add(new go.PathSegment(go.PathSegment.Line, 40, 300))

      // Right bracket
      fig.add(new go.PathSegment(go.PathSegment.Move, 310, 30));
      fig.add(new go.PathSegment(go.PathSegment.Line, 330, 30))
      fig.add(new go.PathSegment(go.PathSegment.Line, 330, 300))
      fig.add(new go.PathSegment(go.PathSegment.Line, 310, 300))

      geo.add(fig);
      return geo;
    });
  
    setShape(currShape)
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
      }
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
      },
    ],
    hasCentral: false,
    reference: ['A', 'AB', 'B'],
    template: [0, 0],
    distributionTemplate: {'A': [0, 0], 'AB': [0, 0], 'B': [0, 0]},
  },

  'TwoElementsIon': {
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
      },
      {
        type: 'electron',
        element: 'X',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#fff",
        ports: [
          { id: "X", spot: "0.5 0.5", fill: null },
        ],
      }
    ],
    data :[{
      height: 120,
      width: 240,
      figshape: "TwoElementsIon",
      ports: [
        { id: "A1", spot: "0.084 0.48" },    //left
        { id: "A2", spot: "0.084 0.52" },
        { id: "A3", spot: "0.32 0" }, //top
        { id: "A4", spot: "0.34 0" },
        { id: "A5", spot: "0.32 1" }, //bottom
        { id: "A6", spot: "0.34 1" },
  
        { id: "B1", spot: "0.916 0.48" },    //right
        { id: "B2", spot: "0.916 0.52" },
        { id: "B3", spot: "0.66 0" },  //top
        { id: "B4", spot: "0.68 0" },
        { id: "B5", spot: "0.66 1" },  //bottom
        { id: "B6", spot: "0.68 1" },
  
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
        position: new go.Point(75, 50),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(160, 50),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'ionCharge',
        ionCharge: '-',
        position: new go.Point(245, -10),
        category: 'ionCharge',
      }
    ],
    hasCentral: false,
    reference: ['A', 'AB', 'B'],
    template: [0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0], 'AB': [0, 0, 0], 'B': [0, 0, 0]},
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
    reference: [['A'], ['B', 'AB'], ['C', 'AC']],
    template: [0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0], 'B': [0, 0, 0], 'AB': [0, 0, 0], 'C': [0, 0, 0], 'AC': [0, 0, 0]},
  },

  'ThreeElementsIon': {
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
      },
      {
        type: 'electron',
        element: 'X',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#fff",
        ports: [
          { id: "X", spot: "0.5 0.5", fill: null },
        ],
      }
    ],
    data: [{
      height: 120,
      width: 300,
      figshape: "ThreeElementsIon",
      ports: [
        { id: "B1", spot: "0.05 0.48" },   //left
        { id: "B2", spot: "0.05 0.52" },
        { id: "B3", spot: "0.22 0.04" },   //top   
        { id: "B4", spot: "0.24 0.04" },
        { id: "B5", spot: "0.22 0.96" },   //bottom
        { id: "B6", spot: "0.24 0.96" },
  
        { id: "A1", spot: "0.49 0.04" },   //top
        { id: "A2", spot: "0.51 0.04" },
        { id: "A3", spot: "0.49 0.96" },   //bottom
        { id: "A4", spot: "0.51 0.96" },
  
        { id: "C1", spot: "0.95 0.48" },   //right
        { id: "C2", spot: "0.95 0.52" },
        { id: "C3", spot: "0.76 0.04" },   //top
        { id: "C4", spot: "0.78 0.04" },
        { id: "C5", spot: "0.76 0.96" },   //bottom
        { id: "C6", spot: "0.78 0.96" },
  
        { id: "AB1", spot: "0.365 0.25" },
        { id: "AB2", spot: "0.365 0.35" },
        { id: "AB3", spot: "0.365 0.45" },
        { id: "AB4", spot: "0.365 0.55" },
        { id: "AB5", spot: "0.365 0.65" },
        { id: "AB6", spot: "0.365 0.75" },
  
        { id: "AC1", spot: "0.635 0.25" },
        { id: "AC2", spot: "0.635 0.35" },
        { id: "AC3", spot: "0.635 0.45" },
        { id: "AC4", spot: "0.635 0.55" },
        { id: "AC5", spot: "0.635 0.65" },
        { id: "AC6", spot: "0.635 0.75" },
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
        position: new go.Point(65, 50),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(227, 50),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'ionCharge',
        ionCharge: '-',
        position: new go.Point(305, -10),
        category: 'ionCharge',
      },
    ],
    hasCentral: true,
    reference: [['A'], ['B', 'AB'], ['C', 'AC']],
    template: [0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0], 'B': [0, 0, 0, 0], 'AB': [0, 0, 0, 0], 'C': [0, 0, 0, 0], 'AC': [0, 0, 0, 0]},
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
      },
    ],
    data: [{
      height: 250,
      width: 300,
      figshape: "FourElements",
      ports: [
        { id: "B1", spot: "0 0.7" },    //left
        { id: "B2", spot: "0 0.72" },   
        { id: "B3", spot: "0.19 0.475" },    //top
        { id: "B4", spot: "0.21 0.475" },
        { id: "B5", spot: "0.19 0.962" },    //bottom
        { id: "B6", spot: "0.21 0.962" },
  
        { id: "A1", spot: "0.49 0.84" },    //bottom
        { id: "A2", spot: "0.51 0.84" },
  
        { id: "C1", spot: "1 0.7" },    //right
        { id: "C2", spot: "1 0.72" },
        { id: "C3", spot: "0.79 0.475" },    //top
        { id: "C4", spot: "0.81 0.475" },
        { id: "C5", spot: "0.79 0.96" },    //bottom
        { id: "C6", spot: "0.81 0.96" },

        { id: "D1", spot: "0.49 0" },   //top
        { id: "D2", spot: "0.51 0" },
        { id: "D3", spot: "0.298 0.23" },    //left
        { id: "D4", spot: "0.298 0.25" },
        { id: "D5", spot: "0.702 0.23" },    //right
        { id: "D6", spot: "0.702 0.25" },
  
        { id: "AB1", spot: "0.323 0.56" },
        { id: "AB2", spot: "0.333 0.6" },
        { id: "AB3", spot: "0.345 0.64" },
        { id: "AB4", spot: "0.357 0.68" },
        { id: "AB5", spot: "0.368 0.72" },
        { id: "AB6", spot: "0.378 0.76" },

        { id: "AD1", spot: "0.4 0.42" },
        { id: "AD2", spot: "0.44 0.42" },
        { id: "AD3", spot: "0.48 0.42" },
        { id: "AD4", spot: "0.52 0.42" },
        { id: "AD5", spot: "0.56 0.42" },
        { id: "AD6", spot: "0.6 0.42" },

        { id: "AC1", spot: "0.677 0.56" },
        { id: "AC2", spot: "0.667 0.6" },
        { id: "AC3", spot: "0.655 0.64" },
        { id: "AC4", spot: "0.643 0.68" },
        { id: "AC5", spot: "0.632 0.72" },
        { id: "AC6", spot: "0.622 0.76" },
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
        position: new go.Point(58, 170),
        category: 'elementName',
        shape: 'Xline',
      },

      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(238, 170),
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
    reference: [['A'], ['B', 'AB'], ['C', 'AC'], ['D', 'AD']],
    template: [0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0], 'B': [0, 0, 0, 0], 'AB': [0, 0, 0, 0], 'C': [0, 0, 0, 0], 'AC': [0, 0, 0, 0], 'D': [0, 0, 0, 0], 'AD': [0, 0, 0, 0]},
  },

  'FourElementsIon': {
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
      },
      {
        type: 'electron',
        element: 'X',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#fff",
        ports: [
          { id: "X", spot: "0.5 0.5", fill: null },
        ],
      }
    ],
    data: [{
      height: 250,
      width: 340,
      figshape: "FourElementsIon",
      ports: [
        { id: "B1", spot: "0.057 0.74" },    //left
        { id: "B2", spot: "0.057 0.76" },   
        { id: "B3", spot: "0.23 0.493" },    //top
        { id: "B4", spot: "0.25 0.493" },
        { id: "B5", spot: "0.23 0.993" },    //bottom
        { id: "B6", spot: "0.25 0.993" },
  
        { id: "A1", spot: "0.49 0.87" },    //bottom
        { id: "A2", spot: "0.51 0.87" },
  
        { id: "C1", spot: "0.943 0.74" },    //right
        { id: "C2", spot: "0.943 0.76" },
        { id: "C3", spot: "0.75 0.493" },    //top
        { id: "C4", spot: "0.77 0.493" },
        { id: "C5", spot: "0.75 0.993" },    //bottom
        { id: "C6", spot: "0.77 0.993" },

        { id: "D1", spot: "0.49 0" },   //top
        { id: "D2", spot: "0.51 0" },
        { id: "D3", spot: "0.316 0.23" },    //left
        { id: "D4", spot: "0.316 0.25" },
        { id: "D5", spot: "0.684 0.23" },    //right
        { id: "D6", spot: "0.684 0.25" },
  
        { id: "AB1", spot: "0.34 0.57" },
        { id: "AB2", spot: "0.352 0.614" },
        { id: "AB3", spot: "0.364 0.658" },
        { id: "AB4", spot: "0.376 0.702" },
        { id: "AB5", spot: "0.388 0.746" },
        { id: "AB6", spot: "0.4 0.79" },

        { id: "AD1", spot: "0.41 0.43" },
        { id: "AD2", spot: "0.446 0.43" },
        { id: "AD3", spot: "0.482 0.43" },
        { id: "AD4", spot: "0.518 0.43" },
        { id: "AD5", spot: "0.554 0.43" },
        { id: "AD6", spot: "0.59 0.43" },

        { id: "AC1", spot: "0.66 0.57" },
        { id: "AC2", spot: "0.648 0.614" },
        { id: "AC3", spot: "0.634 0.658" },
        { id: "AC4", spot: "0.624 0.702" },
        { id: "AC5", spot: "0.612 0.746" },
        { id: "AC6", spot: "0.6 0.79" },
      ],
      selectable: false,
      movable: false,
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(165, 145),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(80, 175),
        category: 'elementName',
        shape: 'Xline',
      },

      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(255, 175),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(165, 55),
        category: 'elementName',
        shape: 'Triangle',
      },
      {
        type: 'ionCharge',
        ionCharge: '-',
        position: new go.Point(350, -5),
        category: 'ionCharge',
        shape: 'Triangle',
      }
    ],
    hasCentral: true,
    reference: [['A'], ['B', 'AB'], ['C', 'AC'], ['D', 'AD']],
    template: [0, 0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0, 0], 'B': [0, 0, 0, 0, 0], 'AB': [0, 0, 0, 0, 0], 'C': [0, 0, 0, 0, 0], 'AC': [0, 0, 0, 0, 0], 'D': [0, 0, 0, 0, 0], 'AD': [0, 0, 0, 0, 0]},
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
    reference: ['A', 'AB', 'B', 'BC', 'C', 'CD', 'D'],
    template: [0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0, 0], 'AB': [0, 0, 0, 0, 0], 'B': [0, 0, 0, 0, 0], 'BC': [0, 0, 0, 0, 0], 'C': [0, 0, 0, 0, 0], 'CD': [0, 0, 0, 0, 0], 'D': [0, 0, 0, 0, 0]},
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
      },
    ],
    data: [{
      height: 300,
      width: 300,
      figshape: "FiveElements",
      ports: [
        { id: "B1", spot: "0.1 0.49" },    //left
        { id: "B2", spot: "0.1 0.51" },   
        { id: "B3", spot: "0.24 0.35" },    //top
        { id: "B4", spot: "0.26 0.35" },
        { id: "B5", spot: "0.24 0.65" },    //bottom
        { id: "B6", spot: "0.26 0.65" },

        { id: "A1", spot: "0.35 0.365" },    //top left
        { id: "A2", spot: "0.365 0.35" },   
        { id: "A3", spot: "0.65 0.365" },    // top right
        { id: "A4", spot: "0.635 0.35" },
        { id: "A5", spot: "0.65 0.635" },    //bottom right
        { id: "A6", spot: "0.635 0.65" },
        { id: "A7", spot: "0.35 0.635" },    //bottom left
        { id: "A8", spot: "0.365 0.65" },
  
        { id: "D1", spot: "0.9 0.49" },    //right
        { id: "D2", spot: "0.9 0.51" },   
        { id: "D3", spot: "0.74 0.35" },    //top
        { id: "D4", spot: "0.76 0.35" },
        { id: "D5", spot: "0.74 0.65" },    //bottom
        { id: "D6", spot: "0.76 0.65" },
        
        { id: "C1", spot: "0.35 0.24" },    //left
        { id: "C2", spot: "0.35 0.26" },   
        { id: "C3", spot: "0.65 0.24" },    //right
        { id: "C4", spot: "0.65 0.26" },
        { id: "C5", spot: "0.49 0.1" },    //top
        { id: "C6", spot: "0.51 0.1" },

        { id: "E1", spot: "0.35 0.74" },    //left
        { id: "E2", spot: "0.35 0.76" },   
        { id: "E3", spot: "0.65 0.74" },    //right
        { id: "E4", spot: "0.65 0.76" },
        { id: "E5", spot: "0.49 0.9" },    //bottom
        { id: "E6", spot: "0.51 0.9" },
  
        { id: "AB1", spot: "0.34 0.4" },
        { id: "AB2", spot: "0.34 0.44" },
        { id: "AB3", spot: "0.34 0.48" },
        { id: "AB4", spot: "0.34 0.52" },
        { id: "AB5", spot: "0.34 0.56" },
        { id: "AB6", spot: "0.34 0.6" },

        { id: "AD1", spot: "0.66 0.4" },
        { id: "AD2", spot: "0.66 0.44" },
        { id: "AD3", spot: "0.66 0.48" },
        { id: "AD4", spot: "0.66 0.52" },
        { id: "AD5", spot: "0.66 0.56" },
        { id: "AD6", spot: "0.66 0.6" },

        { id: "AC1", spot: "0.4 0.34" },
        { id: "AC2", spot: "0.44 0.34" },
        { id: "AC3", spot: "0.48 0.34" },
        { id: "AC4", spot: "0.52 0.34" },
        { id: "AC5", spot: "0.56 0.34" },
        { id: "AC6", spot: "0.6 0.34" },

        { id: "AE1", spot: "0.4 0.66" },
        { id: "AE2", spot: "0.44 0.66" },
        { id: "AE3", spot: "0.48 0.66" },
        { id: "AE4", spot: "0.52 0.66" },
        { id: "AE5", spot: "0.56 0.66" },
        { id: "AE6", spot: "0.6 0.66" },
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
        position: new go.Point(70, 140),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(145, 65),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(225, 140),
        category: 'elementName',
        shape: 'Triangle',
      },
      {
        type: 'elementName',
        element: 'E',
        elementName: 'E',
        position: new go.Point(145, 220),
        category: 'elementName',
        shape: 'Square',
      }
    ],
    hasCentral: true,
    reference: [['A'], ['B', 'AB'], ['C', 'AC'], ['D', 'AD'], ['E', 'AE']],
    template: [0, 0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0, 0], 'B': [0, 0, 0, 0, 0], 'AB': [0, 0, 0, 0, 0], 'C': [0, 0, 0, 0, 0], 'AC': [0, 0, 0, 0, 0], 'D': [0, 0, 0, 0, 0], 'AD': [0, 0, 0, 0, 0], 'E': [0, 0, 0, 0, 0], 'AE': [0, 0, 0, 0, 0]},
  },

  'FiveElementsIon': {
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
      },
      {
        type: 'electron',
        element: 'X',
        figshape: "Circle",
        height: 5,
        width: 5,
        fill: "#fff",
        ports: [
          { id: "X", spot: "0.5 0.5", fill: null },
        ],
      }
    ],
    data: [{
      height: 330,
      width: 330,
      figshape: "FiveElementsIon",
      ports: [
        { id: "B1", spot: "0.1 0.49" },    //left
        { id: "B2", spot: "0.1 0.51" },   
        { id: "B3", spot: "0.24 0.35" },    //top
        { id: "B4", spot: "0.26 0.35" },
        { id: "B5", spot: "0.24 0.65" },    //bottom
        { id: "B6", spot: "0.26 0.65" },

        { id: "A1", spot: "0.35 0.365" },    //top left
        { id: "A2", spot: "0.365 0.35" },   
        { id: "A3", spot: "0.65 0.365" },    // top right
        { id: "A4", spot: "0.635 0.35" },
        { id: "A5", spot: "0.65 0.635" },    //bottom right
        { id: "A6", spot: "0.635 0.65" },
        { id: "A7", spot: "0.35 0.635" },    //bottom left
        { id: "A8", spot: "0.365 0.65" },
  
        { id: "D1", spot: "0.9 0.49" },    //right
        { id: "D2", spot: "0.9 0.51" },   
        { id: "D3", spot: "0.74 0.35" },    //top
        { id: "D4", spot: "0.76 0.35" },
        { id: "D5", spot: "0.74 0.65" },    //bottom
        { id: "D6", spot: "0.76 0.65" },
        
        { id: "C1", spot: "0.35 0.24" },    //left
        { id: "C2", spot: "0.35 0.26" },   
        { id: "C3", spot: "0.65 0.24" },    //right
        { id: "C4", spot: "0.65 0.26" },
        { id: "C5", spot: "0.49 0.1" },    //top
        { id: "C6", spot: "0.51 0.1" },

        { id: "E1", spot: "0.35 0.74" },    //left
        { id: "E2", spot: "0.35 0.76" },   
        { id: "E3", spot: "0.65 0.74" },    //right
        { id: "E4", spot: "0.65 0.76" },
        { id: "E5", spot: "0.49 0.9" },    //bottom
        { id: "E6", spot: "0.51 0.9" },
  
        { id: "AB1", spot: "0.34 0.4" },
        { id: "AB2", spot: "0.34 0.44" },
        { id: "AB3", spot: "0.34 0.48" },
        { id: "AB4", spot: "0.34 0.52" },
        { id: "AB5", spot: "0.34 0.56" },
        { id: "AB6", spot: "0.34 0.6" },

        { id: "AD1", spot: "0.66 0.4" },
        { id: "AD2", spot: "0.66 0.44" },
        { id: "AD3", spot: "0.66 0.48" },
        { id: "AD4", spot: "0.66 0.52" },
        { id: "AD5", spot: "0.66 0.56" },
        { id: "AD6", spot: "0.66 0.6" },

        { id: "AC1", spot: "0.4 0.34" },
        { id: "AC2", spot: "0.44 0.34" },
        { id: "AC3", spot: "0.48 0.34" },
        { id: "AC4", spot: "0.52 0.34" },
        { id: "AC5", spot: "0.56 0.34" },
        { id: "AC6", spot: "0.6 0.34" },

        { id: "AE1", spot: "0.4 0.66" },
        { id: "AE2", spot: "0.44 0.66" },
        { id: "AE3", spot: "0.48 0.66" },
        { id: "AE4", spot: "0.52 0.66" },
        { id: "AE5", spot: "0.56 0.66" },
        { id: "AE6", spot: "0.6 0.66" },
      ],
      selectable: false,
      movable: false,
      },
      {
        type: 'elementName',
        element: 'A',
        elementName: 'A',
        position: new go.Point(160, 155),
        category: 'elementName',
        shape: 'Circle',
      },
      {
        type: 'elementName',
        element: 'B',
        elementName: 'B',
        position: new go.Point(75, 155),
        category: 'elementName',
        shape: 'Xline',
      },
      {
        type: 'elementName',
        element: 'C',
        elementName: 'C',
        position: new go.Point(160, 70),
        category: 'elementName',
        shape: 'Diamond',
      },
      {
        type: 'elementName',
        element: 'D',
        elementName: 'D',
        position: new go.Point(245, 155),
        category: 'elementName',
        shape: 'Triangle',
      },
      {
        type: 'elementName',
        element: 'E',
        elementName: 'E',
        position: new go.Point(160, 240),
        category: 'elementName',
        shape: 'Square',
      },
      {
        type: 'ionCharge',
        ionCharge: '+',
        position: new go.Point(340, 20),
        category: 'ionCharge',
      }
    ],
    hasCentral: true,
    reference: [['A'], ['B', 'AB'], ['C', 'AC'], ['D', 'AD'], ['E', 'AE']],
    template: [0, 0, 0, 0, 0, 0],
    distributionTemplate: {'A': [0, 0, 0, 0, 0, 0], 'B': [0, 0, 0, 0, 0, 0], 'AB': [0, 0, 0, 0, 0, 0], 'C': [0, 0, 0, 0, 0, 0], 'AC': [0, 0, 0, 0, 0, 0], 'D': [0, 0, 0, 0, 0, 0], 'AD': [0, 0, 0, 0, 0, 0], 'E': [0, 0, 0, 0, 0, 0], 'AE': [0, 0, 0, 0, 0, 0]},
  }
}

const indexing = {'A':0, 'B':1, 'C':2, 'D':3, 'E':4, 'X': -1}
var currShape = 'TwoElements';
var selected = null;
  
  
  
  
  
// Helper functions
const setShape = (x) => {
    currShape = x
    // Update diagram data
    myDiagram.startTransaction()
    myDiagram.model.nodeDataArray = []
    myDiagram.model.linkDataArray = []
    myDiagram.model.nodeDataArray = [...compoundShape[currShape]['data']]
    myDiagram.commitTransaction()

    // Update palette data
    myPalette.startTransaction()
    myPalette.model.nodeDataArray = []
    myPalette.model.nodeDataArray = [...compoundShape[currShape]['palette']]
    myPalette.commitTransaction()
  
    // Update covers
    covers = document.getElementsByClassName('compoundName')
    for(let i of covers){
      i.innerText = x
    }
  
    // Update legend
    const currElectrons = []
    for(let e of myPalette.model.nodeDataArray){
      currElectrons.push(e.element)
    }

    const electrons = document.getElementsByClassName('legendText')
    for(let i of electrons){
      if(currElectrons.indexOf(i.id) != -1){
        document.getElementById(i.id).style.display = 'block'
      } else if (i.id != '') {
        document.getElementById(i.id).style.display = 'none'
      }
    }
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

// Converts current model data into JSON
const getModel = () => {
  var snapshot = myDiagram.model.toJson()
  console.log(snapshot)
  return snapshot
}

// Uses JSON info to replicate in diagram, including both nodes and links
const replicate = () => {
  var siu =  "{ \"class\": \"GraphLinksModel\",\n  \"copiesArrays\": true,\n  \"copiesArrayObjects\": true,\n  \"linkFromPortIdProperty\": \"fid\",\n  \"linkToPortIdProperty\": \"tid\",\n  \"nodeDataArray\": [\n{\"height\":120,\"width\":200,\"figshape\":\"TwoElements\",\"ports\":[{\"id\":\"A1\",\"spot\":\"0 0.48\"},{\"id\":\"A2\",\"spot\":\"0 0.52\"},{\"id\":\"A3\",\"spot\":\"0.27 0.02\"},{\"id\":\"A4\",\"spot\":\"0.3 0.02\"},{\"id\":\"A5\",\"spot\":\"0.27 0.98\"},{\"id\":\"A6\",\"spot\":\"0.3 0.98\"},{\"id\":\"B1\",\"spot\":\"1 0.48\"},{\"id\":\"B2\",\"spot\":\"1 0.52\"},{\"id\":\"B3\",\"spot\":\"0.7 0.02\"},{\"id\":\"B4\",\"spot\":\"0.73 0.02\"},{\"id\":\"B5\",\"spot\":\"0.7 0.98\"},{\"id\":\"B6\",\"spot\":\"0.73 0.98\"},{\"id\":\"AB1\",\"spot\":\"0.5 0.25\"},{\"id\":\"AB2\",\"spot\":\"0.5 0.35\"},{\"id\":\"AB3\",\"spot\":\"0.5 0.45\"},{\"id\":\"AB4\",\"spot\":\"0.5 0.55\"},{\"id\":\"AB5\",\"spot\":\"0.5 0.65\"},{\"id\":\"AB6\",\"spot\":\"0.5 0.75\"}],\"selectable\":false,\"movable\":false,\"key\":-1,\"loc\":\"102 60.5\"},\n{\"type\":\"elementName\",\"element\":\"A\",\"elementName\":\"SI\",\"position\":{\"class\":\"go.Point\",\"x\":55,\"y\":50},\"category\":\"elementName\",\"shape\":\"Circle\",\"key\":-2},\n{\"type\":\"elementName\",\"element\":\"B\",\"elementName\":\"UU\",\"position\":{\"class\":\"go.Point\",\"x\":142,\"y\":50},\"category\":\"elementName\",\"shape\":\"Xline\",\"key\":-3},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-4,\"loc\":\"55.77 2.42\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-5,\"loc\":\"102 42.349999999999994\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-6,\"loc\":\"102 54.45\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-7,\"loc\":\"142.2 2.42\"}\n],\n  \"linkDataArray\": [\n{\"from\":-4,\"to\":-1,\"fid\":\"A\",\"tid\":\"A3\"},\n{\"from\":-5,\"to\":-1,\"fid\":\"A\",\"tid\":\"AB2\"},\n{\"from\":-6,\"to\":-1,\"fid\":\"B\",\"tid\":\"AB3\"},\n{\"from\":-7,\"to\":-1,\"fid\":\"A\",\"tid\":\"B3\"}\n]}"
  
  var oh =  "{ \"class\": \"GraphLinksModel\",\n \"copiesArrays\": true,\n \"copiesArrayObjects\": true,\n \"linkFromPortIdProperty\": \"fid\",\n \"linkToPortIdProperty\": \"tid\",\n \"nodeDataArray\": [\n{\"height\":120,\"width\":240,\"figshape\":\"TwoElementsIon\",\"ports\":[{\"id\":\"A1\",\"spot\":\"0.084 0.48\"},{\"id\":\"A2\",\"spot\":\"0.084 0.52\"},{\"id\":\"A3\",\"spot\":\"0.32 0\"},{\"id\":\"A4\",\"spot\":\"0.34 0\"},{\"id\":\"A5\",\"spot\":\"0.32 1\"},{\"id\":\"A6\",\"spot\":\"0.34 1\"},{\"id\":\"B1\",\"spot\":\"0.916 0.48\"},{\"id\":\"B2\",\"spot\":\"0.916 0.52\"},{\"id\":\"B3\",\"spot\":\"0.66 0\"},{\"id\":\"B4\",\"spot\":\"0.68 0\"},{\"id\":\"B5\",\"spot\":\"0.66 1\"},{\"id\":\"B6\",\"spot\":\"0.68 1\"},{\"id\":\"AB1\",\"spot\":\"0.5 0.25\"},{\"id\":\"AB2\",\"spot\":\"0.5 0.35\"},{\"id\":\"AB3\",\"spot\":\"0.5 0.45\"},{\"id\":\"AB4\",\"spot\":\"0.5 0.55\"},{\"id\":\"AB5\",\"spot\":\"0.5 0.65\"},{\"id\":\"AB6\",\"spot\":\"0.5 0.75\"}],\"selectable\":false,\"movable\":false,\"key\":-1,\"loc\":\"120.5 62\"},\n{\"type\":\"elementName\",\"element\":\"A\",\"elementName\":\"O\",\"position\":{\"class\":\"go.Point\",\"x\":75,\"y\":50},\"category\":\"elementName\",\"shape\":\"Circle\",\"key\":-2},\n{\"type\":\"elementName\",\"element\":\"B\",\"elementName\":\"H\",\"position\":{\"class\":\"go.Point\",\"x\":160,\"y\":50},\"category\":\"elementName\",\"shape\":\"Xline\",\"key\":-3},\n{\"type\":\"ionCharge\",\"ionCharge\":\"-\",\"position\":{\"class\":\"go.Point\",\"x\":245,\"y\":-10},\"category\":\"ionCharge\",\"key\":-4},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-5,\"loc\":\"81.94000000000001 1.5\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-6,\"loc\":\"77.12 1.5\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-7,\"loc\":\"20.244 59.58\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-8,\"loc\":\"81.94000000000001 122.5\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-9,\"loc\":\"120.5 55.95\"},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-10,\"loc\":\"77.12 122.5\"},\n{\"type\":\"electron\",\"element\":\"X\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#fff\",\"ports\":[{\"id\":\"X\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-11,\"loc\":\"20.244 64.42\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-12,\"loc\":\"120.5 68.05000000000001\"}\n],\n \"linkDataArray\": [\n{\"from\":-5,\"to\":-1,\"fid\":\"A\",\"tid\":\"A4\"},\n{\"from\":-6,\"to\":-1,\"fid\":\"A\",\"tid\":\"A3\"},\n{\"from\":-7,\"to\":-1,\"fid\":\"A\",\"tid\":\"A1\"},\n{\"from\":-9,\"to\":-1,\"fid\":\"A\",\"tid\":\"AB3\"},\n{\"from\":-10,\"to\":-1,\"fid\":\"A\",\"tid\":\"A5\"},\n{\"from\":-8,\"to\":-1,\"fid\":\"A\",\"tid\":\"A6\"},\n{\"from\":-11,\"to\":-1,\"fid\":\"X\",\"tid\":\"A2\"},\n{\"from\":-12,\"to\":-1,\"fid\":\"B\",\"tid\":\"AB4\"}\n]}"
  
  var hcl =  "{ \"class\": \"GraphLinksModel\",\n \"copiesArrays\": true,\n \"copiesArrayObjects\": true,\n \"linkFromPortIdProperty\": \"fid\",\n \"linkToPortIdProperty\": \"tid\",\n \"nodeDataArray\": [\n{\"height\":120,\"width\":200,\"figshape\":\"TwoElements\",\"ports\":[{\"id\":\"A1\",\"spot\":\"0 0.48\"},{\"id\":\"A2\",\"spot\":\"0 0.52\"},{\"id\":\"A3\",\"spot\":\"0.27 0.02\"},{\"id\":\"A4\",\"spot\":\"0.3 0.02\"},{\"id\":\"A5\",\"spot\":\"0.27 0.98\"},{\"id\":\"A6\",\"spot\":\"0.3 0.98\"},{\"id\":\"B1\",\"spot\":\"1 0.48\"},{\"id\":\"B2\",\"spot\":\"1 0.52\"},{\"id\":\"B3\",\"spot\":\"0.7 0.02\"},{\"id\":\"B4\",\"spot\":\"0.73 0.02\"},{\"id\":\"B5\",\"spot\":\"0.7 0.98\"},{\"id\":\"B6\",\"spot\":\"0.73 0.98\"},{\"id\":\"AB1\",\"spot\":\"0.5 0.25\"},{\"id\":\"AB2\",\"spot\":\"0.5 0.35\"},{\"id\":\"AB3\",\"spot\":\"0.5 0.45\"},{\"id\":\"AB4\",\"spot\":\"0.5 0.55\"},{\"id\":\"AB5\",\"spot\":\"0.5 0.65\"},{\"id\":\"AB6\",\"spot\":\"0.5 0.75\"}],\"selectable\":false,\"movable\":false,\"key\":-1,\"loc\":\"102 60.5\"},\n{\"type\":\"elementName\",\"element\":\"A\",\"elementName\":\"H\",\"position\":{\"class\":\"go.Point\",\"x\":55,\"y\":50},\"category\":\"elementName\",\"shape\":\"Circle\",\"key\":-2},\n{\"type\":\"elementName\",\"element\":\"B\",\"elementName\":\"Cl\",\"position\":{\"class\":\"go.Point\",\"x\":142,\"y\":50},\"category\":\"elementName\",\"shape\":\"Xline\",\"key\":-3},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-4,\"loc\":\"102 54.45\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-5,\"loc\":\"102 66.55000000000001\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-6,\"loc\":\"142.2 2.42\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-7,\"loc\":\"148.23 2.42\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-8,\"loc\":\"202.5 62.92\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-9,\"loc\":\"202.5 58.08\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-10,\"loc\":\"142.2 118.58\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-11,\"loc\":\"148.23 118.58\"}\n],\n \"linkDataArray\": [\n{\"from\":-4,\"to\":-1,\"fid\":\"A\",\"tid\":\"AB3\"},\n{\"from\":-5,\"to\":-1,\"fid\":\"B\",\"tid\":\"AB4\"},\n{\"from\":-6,\"to\":-1,\"fid\":\"B\",\"tid\":\"B3\"},\n{\"from\":-7,\"to\":-1,\"fid\":\"B\",\"tid\":\"B4\"},\n{\"from\":-8,\"to\":-1,\"fid\":\"B\",\"tid\":\"B2\"},\n{\"from\":-9,\"to\":-1,\"fid\":\"B\",\"tid\":\"B1\"},\n{\"from\":-10,\"to\":-1,\"fid\":\"B\",\"tid\":\"B5\"},\n{\"from\":-11,\"to\":-1,\"fid\":\"B\",\"tid\":\"B6\"}\n]}"
  
  var x =  "{ \"class\": \"GraphLinksModel\",\n  \"copiesArrays\": true,\n  \"copiesArrayObjects\": true,\n  \"linkFromPortIdProperty\": \"fid\",\n  \"linkToPortIdProperty\": \"tid\",\n  \"nodeDataArray\": [\n{\"height\":120,\"width\":200,\"figshape\":\"TwoElements\",\"ports\":[{\"id\":\"A1\",\"spot\":\"0 0.48\"},{\"id\":\"A2\",\"spot\":\"0 0.52\"},{\"id\":\"A3\",\"spot\":\"0.27 0.02\"},{\"id\":\"A4\",\"spot\":\"0.3 0.02\"},{\"id\":\"A5\",\"spot\":\"0.27 0.98\"},{\"id\":\"A6\",\"spot\":\"0.3 0.98\"},{\"id\":\"B1\",\"spot\":\"1 0.48\"},{\"id\":\"B2\",\"spot\":\"1 0.52\"},{\"id\":\"B3\",\"spot\":\"0.7 0.02\"},{\"id\":\"B4\",\"spot\":\"0.73 0.02\"},{\"id\":\"B5\",\"spot\":\"0.7 0.98\"},{\"id\":\"B6\",\"spot\":\"0.73 0.98\"},{\"id\":\"AB1\",\"spot\":\"0.5 0.25\"},{\"id\":\"AB2\",\"spot\":\"0.5 0.35\"},{\"id\":\"AB3\",\"spot\":\"0.5 0.45\"},{\"id\":\"AB4\",\"spot\":\"0.5 0.55\"},{\"id\":\"AB5\",\"spot\":\"0.5 0.65\"},{\"id\":\"AB6\",\"spot\":\"0.5 0.75\"}],\"selectable\":false,\"movable\":false,\"key\":-1,\"loc\":\"102 60.5\"},\n{\"type\":\"elementName\",\"element\":\"A\",\"elementName\":\"H\",\"position\":{\"class\":\"go.Point\",\"x\":55,\"y\":50},\"category\":\"elementName\",\"shape\":\"Circle\",\"key\":-2},\n{\"type\":\"elementName\",\"element\":\"B\",\"elementName\":\"Cl\",\"position\":{\"class\":\"go.Point\",\"x\":142,\"y\":50},\"category\":\"elementName\",\"shape\":\"Xline\",\"key\":-3},\n{\"type\":\"electron\",\"element\":\"A\",\"figshape\":\"Circle\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"A\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-4,\"loc\":\"102 54.45\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-5,\"loc\":\"102 66.55000000000001\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-6,\"loc\":\"142.2 2.42\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-7,\"loc\":\"148.23 2.42\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-8,\"loc\":\"202.5 58.08\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-9,\"loc\":\"202.5 62.92\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-10,\"loc\":\"148.23 118.58\"},\n{\"type\":\"electron\",\"element\":\"B\",\"figshape\":\"Xline\",\"height\":5,\"width\":5,\"fill\":\"#000\",\"ports\":[{\"id\":\"B\",\"spot\":\"0.5 0.5\",\"fill\":null}],\"key\":-11,\"loc\":\"142.2 118.58\"}\n],\n  \"linkDataArray\": [\n{\"from\":-4,\"to\":-1,\"fid\":\"A\",\"tid\":\"AB3\"},\n{\"from\":-5,\"to\":-1,\"fid\":\"B\",\"tid\":\"AB4\"},\n{\"from\":-6,\"to\":-1,\"fid\":\"B\",\"tid\":\"B3\"},\n{\"from\":-7,\"to\":-1,\"fid\":\"B\",\"tid\":\"B4\"},\n{\"from\":-8,\"to\":-1,\"fid\":\"B\",\"tid\":\"B1\"},\n{\"from\":-9,\"to\":-1,\"fid\":\"B\",\"tid\":\"B2\"},\n{\"from\":-10,\"to\":-1,\"fid\":\"B\",\"tid\":\"B6\"},\n{\"from\":-11,\"to\":-1,\"fid\":\"B\",\"tid\":\"B5\"}\n]}"

  // console.log(hcl)
  myDiagram.model = go.Model.fromJson(hcl)
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


  
  
  
// Compound data generation
const generateAnswer = () => {
  var nodeData = myDiagram.model.nodeDataArray
  var linkData = myDiagram.model.linkDataArray
  var hasCentral = compoundShape[currShape].hasCentral
  var reference = [...compoundShape[currShape].reference]

  // Element names
  var elementNames = getElementNames(nodeData)

  // Charge
  var charge = '';
  for(let node of nodeData){
    if(node.type === 'ionCharge'){
      charge = node.ionCharge
    }
  }
  
  // Parsing for electron total and distribution
  var total = 0;
  var template = JSON.parse(JSON.stringify(compoundShape[currShape].template))
  var distributionTemplate = JSON.parse(JSON.stringify(compoundShape[currShape].distributionTemplate))
  for(let e of linkData){
    // Gets variables for adding later
    element = e['tid'].slice(0, -1)
    index = indexing[e['fid']]

    // Increments value at the position given by the variables, handling edge case of -1 (foreign electron)
    if(index === -1){
      var currArr = distributionTemplate[element]
      distributionTemplate[element][currArr.length - 1]++
    } else {
      distributionTemplate[element][index]++
    }
    total++
  }

  // After getting distribution, use reference and insert lists into correct position
  if(hasCentral){
    for(let area of [...reference]){
      var outerIndex = reference.indexOf(area)

      for(let subArea of area){
        var innerIndex = area.indexOf(subArea)
        reference[outerIndex][innerIndex] = distributionTemplate[subArea]
      }
    }
  } else {
    for(let area of [...reference]){
      var index = reference.indexOf(area)
      reference[index] = distributionTemplate[area]
    }
  }

  var snapshot = getModel()
  var ans = {
    snapshot: snapshot,
    shape: currShape,
    charge: charge,
    hasCentral: hasCentral,
    answerArray: elementNames,
    total: total,
    distribution: reference
  }

  document.getElementById('answer').innerText = JSON.stringify(ans)
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