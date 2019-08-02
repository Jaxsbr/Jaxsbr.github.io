(function(){

window.addEventListener('resize', function() {
    resize();
})


var bounds = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
var noticeCanvas = document.getElementById("noticeCanvas");
noticeCanvas.width = window.innerWidth;
noticeCanvas.height = window.innerHeight;
var noticeCtx = noticeCanvas.getContext("2d");


var delta = 0;
var deltaTime = Date.now();

// TEXT LOOPS
var textLoop_001;


var titleFontSize = 32;
var titleText = "Animated Backgrounds";
var titleFontFamily = "Showcard Gothic Bold";
var titleShadowOffset = new Point(1, 1);

var itemTitleFontFamily = "Calibri";
var itemTitleShadowOffset = new Point(3, 3);

var animation;
var animationImage;
var animationDestination = new Rectangle(50, 500, 100, 125);

var textRender;
var paralaxBackgroundSlider;  

var image = new Image();
image.onload = function() {         
    paralaxBackgroundSlider = new ParalaxBackgroundSlider();
    PopulateParalaxBackgrounds();
};
//image.src = "img/trees.png";
image.src = "img/backgroundLayer01.png";

var backgroundImageReady = false;
var backgroundImage = new Image();
// backgroundImage.onload = function() {
//     backgroundImageReady = true;
// };
//backgroundImage.src = "img/background.png";
var backgroundImageBounds = new Rectangle(0, 0, 0, 0);

   


InitTextRender();
InitCharacterAnimation();
Loop();


function resize() {
    noticeCanvas.width = window.innerWidth;
    noticeCanvas.height = window.innerHeight;
    bounds = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
    InitTextRender();
    InitCharacterAnimation();
    paralaxBackgroundSlider.Backgrounds = [];
    PopulateParalaxBackgrounds();
}

function InitTextRender() {    
    textRender = new TextRender();
    textRender.AddTextElement(new TextElement("Contact me at:", "yellow", titleFontFamily, 25, 200, titleFontSize, titleShadowOffset));
    textRender.AddTextElement(new TextElement("jbrink386@gmail.com", "purple", titleFontFamily, 25, 230, titleFontSize, titleShadowOffset));    
}

function InitCharacterAnimation() {        
    var width = bounds.W < 768 ? 50 : 100;
    var height = bounds.W < 768 ? 75 : 125;
    var animationBottomMargin =  (bounds.H / 5);    
    var ycoord = bounds.H - animationBottomMargin - height;

    animationDestination = new Rectangle(200, ycoord, width, height);


    animationImage = new Image();
    animationImage.onload = function() {
        // image, speed, sourceMaxWidth, sourceMaxHeight, frameCols, frameRows, startingCol, startingRow
        animation = new Animation(animationImage, 0.25, 400.25, 599.25, 4, 1, 0, 2);
    }
    animationImage.src = "img/spriteSheet.png";

    // TODO:
    // Implement dance to the beat animation(chillhop)
};


function PopulateParalaxBackgrounds() {
    var increment = bounds.W < 768 ? 1 : 2;

    paralaxBackgroundSlider.Backgrounds.push(
        new ParalaxBackground(4, new Rectangle(0, 0, bounds.W + 4, bounds.H), 1, increment, 0, image));    

    paralaxBackgroundSlider.Backgrounds.push(
        new ParalaxBackground(4, new Rectangle(-bounds.W, 0, bounds.W + 4, bounds.H), 1, increment, 0, image));               
};


function Loop() {           
    UpdateDelta();          
    Update();
    Draw();    

    if (animation) {
        animation.Update(animationDestination, delta);                                
        animation.Draw(noticeCtx);
    }

    requestAnimationFrame(Loop);   
};

function UpdateDelta() {  
    var now = Date.now();                   
    delta = (now - deltaTime) / 1000;
    deltaTime = now;
};

function Update() {    

    if (paralaxBackgroundSlider) {
        paralaxBackgroundSlider.Update(bounds, delta);    
    }

    backgroundImageBounds.X = bounds.X - 155;
    backgroundImageBounds.Y = bounds.Y - 100;
    backgroundImageBounds.W = bounds.W;
    backgroundImageBounds.H = bounds.H;
    
    textRender.Update(delta);    
};

function RandomBetween (min, max) {
    return Math.random() * (max - min) + min;
}

function Draw() {    
    noticeCtx.clearRect(bounds.X, bounds.Y, bounds.W, bounds.H);    
        
    drawFillText(noticeCtx, "black", "Showcard Gothic", 56, "Loading Art ...", (animationDestination.X + animationDestination.W), animationDestination.Y + 110);
    drawFillText(noticeCtx, "maroon", "Showcard Gothic", 56, "Loading Art ...", (animationDestination.X + animationDestination.W + 1), animationDestination.Y + 110 + 1);

    if (this.backgroundImageReady) {
        //drawImage(noticeCtx, this.backgroundImage, backgroundImageBounds, null);
    }
    
    if (paralaxBackgroundSlider) {
        paralaxBackgroundSlider.Draw(noticeCtx); 
    }
        
    textRender.Draw(noticeCtx);    
};
})();