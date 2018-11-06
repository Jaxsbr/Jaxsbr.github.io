class Animation { 
	constructor(image, speed, frameWidth, frameHeight, frameCols, frameRows, frameCol, frameRow) {	
		this.Image = image;	
		this.Speed = speed;	
		this.FrameWidth = frameWidth;
		this.FrameHeight = frameHeight;
		this.FrameCols = frameCols;
		this.FrameRows = frameRows;		
		this.FrameColStart = frameCol;
		this.FrameRowStart = frameRow;	
		this.FrameCol = this.FrameColStart;	
		this.FrameRow = this.FrameRowStart;				
		this.Ellapsed = 0;
    	this.SourceBounds = new Rectangle(0, 0, 0, 0);
    	this.DestinationBounds = new Rectangle(0, 0, 0, 0);
	}

	Update (destination, delta) {
		this.DestinationBounds = destination;
		this.UpdateFrameIndex();
		// NOTE: No support for multiple rows, hardcoded y:0 enforces top row only.
		this.SourceDestination = new Rectangle(this.FrameCol * this.FrameWidth, this.FrameRow * this.FrameHeight, this.FrameWidth, this.FrameHeight); 
	}

	UpdateFrameIndex() {     
		this.Ellapsed += delta;	   
		if (this.Ellapsed >= this.Speed) {	   
			this.Ellapsed = 0;    	   
			  
		  	this.FrameCol += 1;	   
		  	if (this.FrameCol >= this.FrameCols) { 
				  this.FrameCol = this.FrameColStart; 
				  this.FrameRow += 1;
			}    	   

			if (this.FrameRow >= this.FrameRows) {
				this.FrameRow = this.FrameRowStart;
			}
		}  	   
	};
	  

	Draw (ctx) {
		drawImage(ctx, this.Image, this.DestinationBounds, this.SourceDestination);
	}
}
function drawFillRect(ctx, style, rect) {            
    ctx.fillStyle = style; 
    ctx.fillRect(rect.X, rect.Y, rect.W, rect.H);                                        
};

function drawStrokeRect(ctx, style, rect, strokeWidth = 1) {
    ctx.strokeStyle = style;  
    ctx.strokeWidth = strokeWidth;
    ctx.strokeRect(rect.X, rect.Y, rect.W, rect.H);
}

function drawFillArc(ctx, style, centerX, centerY, radius, startAngle = 0, endAngle = 2 * Math.PI) {
    ctx.fillStyle = style;
    ctx.beginPath();    
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.fill();
};

function drawFillText(ctx, style, fontFamily, fontSize, text, x, y) {
    ctx.fillStyle = style;
    ctx.font = fontSize + "px " + fontFamily;        
    ctx.fillText(text, x, y);            
};

function drawImage(ctx, image, destinationRect, sourceRect = null) {
    if (sourceRect) { drawImageComplex(ctx, image, destinationRect, sourceRect); }
    else { drawImageSimple(ctx, image, destinationRect); }
};    

function drawImageSimple(ctx, image, destinationRect) {
    ctx.drawImage(image, destinationRect.X, destinationRect.Y, destinationRect.W, destinationRect.H);
};

function drawImageComplex(ctx, image, destinationRect, sourceRect) {
    ctx.drawImage(image, sourceRect.X, sourceRect.Y, sourceRect.W, sourceRect.H, 
        destinationRect.X, destinationRect.Y, destinationRect.W, destinationRect.H);
};

class ParalaxBackground {
    constructor(id, destination, direction, increment, paralaxMode, image) {   
        this.ID = id; 
        this.Destination = destination;
        this.Direction = direction;
        this.Increment = increment;    
        this.ParalaxMode = paralaxMode; // ScrollingMode = 0, PacingMode = 1
        this.Image = image;
        this.SetImageSourceRect();
    }

    SetImageSourceRect() {
        switch (this.ID) {
            case 1:
                this.ImageSourceRect = new Rectangle(0, 0, 512, 512);
            break;
    
            case 2:            
                this.ImageSourceRect = new Rectangle(512, 0, 512, 512);
            break;
    
            case 3:            
                this.ImageSourceRect = new Rectangle(1024, 0, 512, 512);
            break;
    
            default:            
                this.ImageSourceRect = new Rectangle(0, 0, this.Image.width, this.Image.height);
            break;
        }
    };
    
    Update(drawBounds, delta) {
        if (this.ParalaxMode == 0) {
            this.UpdateScrollingMode(drawBounds, delta);
        }
        else {
            this.UpdatePacingMode(drawBounds, delta);
        }                
    }

    UpdateScrollingMode(drawBounds, delta) {
        if (this.Destination.X > drawBounds.W) {
            this.Destination.X = -drawBounds.W - this.Increment;
        }
        
        this.Destination.X += this.Increment;
    }

    UpdatePacingMode(drawBounds, delta) {   
       if (this.Destination.X < drawBounds.X) {
        this.Destination.X = drawBounds.X;
        this.Direction = 1; // Go Right
       }
    
       if (this.Destination.X + this.Destination.W > drawBounds.W) {
           this.Destination.X = drawBounds.W - this.Destination.W;
           this.Direction = 0; // Go Left
       }
    
       var increment = this.Direction == 0 ? -this.Increment : this.Increment;
       this.Destination.X += increment;
    }
    
    Draw(ctx) {    
        drawImage(ctx, this.Image, this.Destination, this.ImageSourceRect);
    }
}


class ParalaxBackgroundSlider {
    constructor() {
        this.Backgrounds = [];        
    }

    Update(drawBounds, delta) {
        for (var i = 0; i < this.Backgrounds.length; i++) {
            this.Backgrounds[i].Update(drawBounds, delta);        
        }    
    }
    
    Draw(ctx) {
        for (var i = 0; i < this.Backgrounds.length; i++) {
            this.Backgrounds[i].Draw(ctx);
        }    
    }
}
class Point {
    constructor(x, y) {
        this.X = x;
        this.Y = y;            
    }

    DistanceBetween(point) {
        let x = this.X - point.X;
        let y = this.Y - point.Y;
        return Math.sqrt(x * x - y * y);
    }

    Normalize(point) {
        let x = this.X - point.X;
        let y = this.Y - point.Y;
        let distance = Math.sqrt(x * x - y * y);
        return new Point(x / distance, y / distance);
    }
}
class Rectangle {
    constructor (x, y, w, h) {
        this.X = x;
        this.Y = y;
        this.W = w;
        this.H = h;

        this.Left = this.X;
        this.Top = this.Y;
        this.Right = 0;
        this.Botton = 0;
        this.Centre = new Point(0, 0);

        this.Update();
    }

    Update() {
        this.Left = this.X;
        this.Top = this.Y;
        this.Right = this.Left + this.W;
        this.Botton = this.Top + this.H;

        this.Centre.X = this.X + (this.W / 2);
        this.Centre.Y = this.Y + (this.H / 2);
    }

    Intersect(rectangle) {
        return !(rectangle.Left > this.Right ||
                rectangle.Right < this.Left ||
                rectangle.Left > this.Bottom ||
                rectangle.Bottom < this.Top);
    }

    Contains(rectangle) {
        return (this.Left <= rectangle.Left &&
                rectangle.Right <= this.Right &&
                this.Top <= rectangle.Top &&
                rectangle.Bottom <= this.Bottom);
    }
}
class TextElement {
    constructor(text, style, fontFamily, textX, textY, fontSize, shadowOffset) {
        this.Text = text;
        this.Style = style;
        this.FontFamily = fontFamily
        this.TextX = textX;
        this.TextY = textY;    
        this.FontSize = fontSize;

        this.ShadowStyle = "black";
        this.ShadowX = shadowOffset.X;
        this.ShadowY = shadowOffset.Y;

        // TODO:
        // Create animation type, determine movement pattern.
    }

    Update(delta) {
        // TODO:
        // Animation modes movement should be update here.
    }
    
    Draw(ctx) {
        drawFillText(
            ctx, 
            this.ShadowStyle, 
            this.FontFamily, 
            this.FontSize, 
            this.Text, 
            this.TextX + this.ShadowX, 
            this.TextY + this.ShadowY);
    
        drawFillText(
            ctx, 
            this.Style, 
            this.FontFamily, 
            this.FontSize, 
            this.Text, 
            this.TextX, 
            this.TextY);
    }
}



class TextRender {
    constructor() {
        this.TextElements = [];
    }

    AddTextElement(textElement) {
        this.TextElements.push(textElement);
    }

    Update(delta) {
        for (var i = 0; i < this.TextElements.length; i++) {
            this.TextElements[i].Update(delta);
        }
    }
    
    Draw(ctx) {
        for (var i = 0; i < this.TextElements.length; i++) {
            this.TextElements[i].Draw(ctx);
        }
    }
}